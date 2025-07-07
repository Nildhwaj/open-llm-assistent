// server.js  (CommonJS version)

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const Imagine = require("imaginejs");
dotenv.config(); // reads .env in project root

const {
  PORT = 5000,
  MONGODB_URI,
  OLLAMA_HOST = "http://127.0.0.1:11434",
  TEXT_MODEL = "llama3",
  IMAGE_MODEL = "",
} = process.env;

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ← NEW

app.use(express.static("public"));
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;
  try {
    const { data } = await axios.post(
      `${OLLAMA_HOST}/api/chat`,
      {
        model: TEXT_MODEL,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Format your answers using **Markdown**. Use bullet points, numbered lists, bold key terms, and headings when appropriate. Be concise and structured.",
          },
          { role: "user", content: prompt },
        ],
      },
      { timeout: 0 }
    );
    res.json({ bot: data.message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/image", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const { data } = await axios.post(
      `${OLLAMA_HOST}/api/generate`,
      {
        model: IMAGE_MODEL || "sdxl-lightning",
        prompt: prompt,
        stream: false,
        format: "png",
      },
      { timeout: 0 }
    );
    const b64 = data.response || data.image || data.images?.[0];
    if (!b64) throw new Error("No image returned from Ollama");

    const buffer = Buffer.from(b64, "base64");
    const fileName = `img_${Date.now()}.png`;
    await fs.writeFile(path.join(__dirname, "public", fileName), buffer);

    res.json({ url: fileName });
  } catch (err) {
    console.error("Image generation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/summarise", upload.single("doc"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let text;

    if (ext === ".pdf") {
      const buffer = await fs.readFile(filePath);
      text = (await pdfParse(buffer)).text;
    } else if (ext === ".docx") {
      text = (await mammoth.extractRawText({ path: filePath })).value;
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }
    await fs.unlink(filePath); // clean up uploaded file

    const chunk = text.slice(0, 16000); // keep it short for the LLM

    const { data } = await axios.post(
      `${OLLAMA_HOST}/api/chat`,
      {
        model: TEXT_MODEL,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "Summarise the following document in clear bullet points, numbered lists, bold key terms, and headings when appropriate. Be concise and structured..",
          },
          { role: "user", content: chunk },
        ],
      },
      { timeout: 0 }
    );

    res.json({ summary: data.message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/audio", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  try {
    const { data } = await axios.post(
      `${OLLAMA_HOST}/api/generate`,
      {
        model: process.env.AUDIO_MODEL || "tts-en-v1",
        prompt: text,
        stream: false,
        format: "wav", // or "mp3" – pick what the model supports
      },
      { timeout: 0 }
    );

    // Ollama returns something like { response: "<base64‑wav>" }
    const b64 = data.response || data.audio || data.wav;
    if (!b64) throw new Error("No audio data returned from Ollama");

    const buffer = Buffer.from(b64, "base64");
    const filename = `audio_${Date.now()}.wav`;
    await fs.writeFile(path.join(__dirname, "public", filename), buffer);

    res.json({ url: filename }); // e.g.  { "url": "audio_1720356.wav" }
  } catch (err) {
    console.error("TTS error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

(async () => {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    app.locals.db = client.db();
    app.listen(PORT, () =>
      console.log(`Server running at http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
})();
