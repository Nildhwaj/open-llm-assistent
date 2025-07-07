/********************  Loader + Typing Helpers  ********************/
let loadTimer = null;

// ① tiny “…” loader ------------------------------------------------
function showLoader($bubble) {
  let dots = "";
  loadTimer = setInterval(() => {
    dots = dots.length < 3 ? dots + "." : "";
    $bubble.text("💭 " + dots); // shows “💭 .”, “💭 ..”, “💭 …”
  }, 300);
}

// ② safer HTML typewriter (keeps tags intact) ----------------------
function typeHTML(targetEl, html, speed = 18) {
  let i = 0,
    txt = "",
    insideTag = false;

  function type() {
    if (i < html.length) {
      const ch = html.charAt(i);
      txt += ch;
      if (ch === "<") insideTag = true;
      if (!insideTag) targetEl.innerHTML = txt;
      if (ch === ">") {
        insideTag = false;
        targetEl.innerHTML = txt;
      }
      i++;
      setTimeout(type, insideTag ? 0 : speed);
    }
  }
  type();
}

function appendMessage(content, sender = "bot") {
  const msg = $("<div>").addClass("message").addClass(sender);
  const bubble = $("<div>").addClass("bubble");

  bubble.html(sender === "bot" ? marked.parse(content) : content);
  msg.append(bubble);
  $("#chat").append(msg);
  $("#chat").scrollTop($("#chat")[0].scrollHeight);
}

// $("#askBtn").on("click", async () => {
//   const prompt = $("#chatPrompt").val().trim();
//   if (!prompt) return;
//   appendMessage(prompt, "user");
//   $("#chatPrompt").val("");

//   const { bot } = await $.post("/api/chat", { prompt });
//   appendMessage(bot, "bot");
// });

$("#askBtn").on("click", async () => {
  const prompt = $("#chatPrompt").val().trim();
  if (!prompt) return;

  // USER bubble
  appendMessage(prompt, "user");
  $("#chatPrompt").val("");

  // BOT placeholder bubble
  const $placeholder = $("<div>")
    .addClass("message bot")
    .append($("<div>").addClass("bubble"));
  $("#chat").append($placeholder);
  $("#chat").scrollTop($("#chat")[0].scrollHeight);

  // start loader
  const $bubble = $placeholder.find(".bubble");
  showLoader($bubble);

  try {
    const { bot } = await $.post("/api/chat", { prompt });

    clearInterval(loadTimer);
    $bubble.html(""); // clear loader

    const html = marked.parse(bot); // markdown → HTML
    typeHTML($bubble[0], html); // typewriter
  } catch (err) {
    clearInterval(loadTimer);
    $bubble.text("⚠️ Error: " + err.responseJSON?.error || err.statusText);
  }
});

$("#imgBtn").on("click", async () => {
  const prompt = $("#chatPrompt").val().trim();
  if (!prompt) return;
  appendMessage(prompt, "user");
  $("#chatPrompt").val("");

  const { url } = await $.post("/api/image", { prompt });
  appendMessage(`<img src="${url}" class="preview" />`, "bot");
});

// $("#sumBtn").on("click", async () => {
//   const file = $("#docInput")[0].files[0];
//   if (!file) return alert("Choose a PDF or DOCX file first.");

//   appendMessage("_Uploading document…_", "user");

//   const formData = new FormData();
//   formData.append("doc", file);

//   const res = await fetch("/api/summarise", { method: "POST", body: formData });
//   const data = await res.json();
//   appendMessage(data.summary, "bot");
// });

$("#sumBtn").on("click", async () => {
  const file = $("#docInput")[0].files[0];
  if (!file) return alert("Choose a PDF/DOCX first.");

  appendMessage(`📄 _Uploading **${file.name}**…_`, "user");

  // BOT placeholder
  const $ph = $("<div>")
    .addClass("message bot")
    .append($("<div>").addClass("bubble"));
  $("#chat").append($ph);
  const $b = $ph.find(".bubble");
  showLoader($b);

  const fd = new FormData();
  fd.append("doc", file);

  try {
    const { summary } = await $.ajax({
      url: "/api/summarise",
      method: "POST",
      data: fd,
      processData: false,
      contentType: false,
    });

    clearInterval(loadTimer);
    $b.html("");
    typeHTML($b[0], marked.parse(summary));
  } catch (e) {
    clearInterval(loadTimer);
    $b.text("❌ Failed: " + e.responseJSON?.error || e.statusText);
  }
});

$("#ttsBtn").on("click", async () => {
  const text = $("#chatPrompt").val().trim();
  if (!text) return;

  appendMessage(text, "user");
  $("#chatPrompt").val("");

  const placeholder = $("<div>")
    .addClass("message bot")
    .append($("<div>").addClass("bubble").text("🔈 Generating audio…"));
  $("#chat").append(placeholder);
  $("#chat").scrollTop($("#chat")[0].scrollHeight);

  try {
    const { url } = await $.post("/api/audio", { text });
    const audioHTML = `<audio controls src="${url}" style="margin-top:.5rem"></audio>`;
    placeholder.find(".bubble").html(audioHTML);
  } catch (e) {
    placeholder
      .find(".bubble")
      .text("❌ TTS failed: " + e.responseJSON?.error || e.statusText);
  }
});
