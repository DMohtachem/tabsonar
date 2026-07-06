const $btn = document.getElementById("grant");
const $status = document.getElementById("status");

$btn.addEventListener("click", async () => {
  $status.textContent = "";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Immediately stop — we only needed the permission prompt to resolve.
    stream.getTracks().forEach((t) => t.stop());
    await chrome.storage.local.set({ micReady: true });
    $status.textContent = "✓ Voice enabled. You can close this tab and use the mic in TabSonar.";
    $status.className = "status ok";
    $btn.disabled = true;
  } catch (e) {
    $status.textContent = "Microphone was blocked. Voice stays off — you can still type, or use Wispr Flow.";
    $status.className = "status err";
  }
});
