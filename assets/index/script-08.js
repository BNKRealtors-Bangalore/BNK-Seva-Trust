(() => {
  const section = document.getElementById("temple-updates");
  if (!section) return;

  const modal = document.getElementById("templeUpdatesModal");
  const video = document.getElementById("templeUpdatesVideo");
  const closeButton = modal.querySelector(".temple-updates-close");
  const playButtons = section.querySelectorAll(".temple-update-play");

  let previouslyFocused = null;

  function openVideo(src) {
    previouslyFocused = document.activeElement;

    video.src = src;
    modal.hidden = false;
    document.body.style.overflow = "hidden";

    closeButton.focus();

    video.play().catch(() => {
      // Browser may require an additional user action.
    });
  }

  function closeVideo() {
    video.pause();
    video.removeAttribute("src");
    video.load();

    modal.hidden = true;
    document.body.style.overflow = "";

    previouslyFocused?.focus();
  }

  playButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const videoPath = button.dataset.video;

      if (videoPath) {
        openVideo(videoPath);
      }
    });
  });

  closeButton.addEventListener("click", closeVideo);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeVideo();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeVideo();
    }
  });
})();
