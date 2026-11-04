document.addEventListener("submit", function (event) {
  const form = event.target;
  const message = form.getAttribute("data-confirm");
  if (message && !window.confirm(message)) event.preventDefault();
});

document.addEventListener("click", async function (event) {
  const button = event.target.closest("[data-captcha-refresh]");
  if (!button) return;

  const image = document.getElementById(button.dataset.captchaRefresh);
  const form = button.closest("form");
  const input = form.querySelector('[name="captcha"]');
  const feedback = form.querySelector(".captcha-feedback");
  button.disabled = true;
  feedback.textContent = "";

  try {
    const response = await fetch("/captcha/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ scope: button.dataset.captchaScope }),
    });
    if (!response.ok) throw new Error("Không thể làm mới mã xác nhận.");
    image.src = `/captcha.svg?scope=${encodeURIComponent(button.dataset.captchaScope)}&${Date.now()}`;
    input.value = "";
    input.focus();
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
