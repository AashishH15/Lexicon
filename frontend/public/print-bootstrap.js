(function () {
  "use strict";

  var RESOURCE_TIMEOUT_MS = 5000;

  function waitWithin(promise) {
    return Promise.race([
      Promise.resolve(promise).catch(function () {}),
      new Promise(function (resolve) {
        setTimeout(resolve, RESOURCE_TIMEOUT_MS);
      }),
    ]);
  }

  function waitForImage(image) {
    return new Promise(function (resolve) {
      var settled = false;
      var timeout = setTimeout(finish, RESOURCE_TIMEOUT_MS);

      function finish() {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        image.removeEventListener("load", finish);
        image.removeEventListener("error", finish);
        resolve();
      }

      if (image.complete) {
        finish();
        return;
      }

      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", finish, { once: true });
    }).then(function () {
      if (typeof image.decode === "function") {
        return waitWithin(image.decode());
      }
    });
  }

  function getInvoke() {
    var internals = globalThis.__TAURI_INTERNALS__;
    if (!internals || typeof internals.invoke !== "function") {
      throw new Error("The native PDF bridge is unavailable.");
    }
    return internals.invoke.bind(internals);
  }

  function createPreviewToolbar() {
    var toolbar = document.createElement("div");
    toolbar.id = "lexicon-pdf-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "PDF preview actions");
    toolbar.style.cssText =
      "position:sticky;top:0;z-index:10;display:flex;align-items:center;" +
      "justify-content:space-between;gap:24px;padding:12px 20px;" +
      "background:#f8f7f3;border-bottom:1px solid #d9d6cc;" +
      "box-shadow:0 1px 5px rgba(30,30,25,.08);font:13px system-ui," +
      "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#292822;";

    var copy = document.createElement("div");
    copy.style.cssText = "display:flex;flex-direction:column;gap:2px;min-width:0;";

    var title = document.createElement("strong");
    title.textContent = "PDF preview";
    title.style.cssText = "font-size:14px;font-weight:650;";
    copy.appendChild(title);

    var status = document.createElement("span");
    status.textContent = "Review your document before saving.";
    status.style.cssText = "font-size:12px;color:#706e65;";
    copy.appendChild(status);
    toolbar.appendChild(copy);

    var actions = document.createElement("div");
    actions.style.cssText =
      "display:flex;align-items:center;gap:8px;flex-shrink:0;";

    var cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.style.cssText =
      "border:1px solid #c9c6bc;border-radius:7px;padding:7px 12px;" +
      "background:transparent;color:#4b4941;font:600 12px system-ui," +
      "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;cursor:pointer;";
    cancelButton.addEventListener("click", function () {
      cancelButton.disabled = true;
      saveButton.disabled = true;
      try {
        getInvoke()("native_pdf_cancel", {});
      } catch (_) {
        // The parent command closes the preview when cancellation is reported.
      }
    });
    actions.appendChild(cancelButton);

    var saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Save PDF";
    saveButton.style.cssText =
      "border:1px solid #292822;border-radius:7px;padding:7px 13px;" +
      "background:#292822;color:#fff;font:600 12px system-ui," +
      "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;cursor:pointer;";
    saveButton.addEventListener("click", function () {
      saveButton.disabled = true;
      cancelButton.disabled = true;
      try {
        Promise.resolve(getInvoke()("native_pdf_save", {})).then(
          function (started) {
            if (!started) {
              saveButton.disabled = false;
              cancelButton.disabled = false;
            }
          },
          function (error) {
            var message = error && error.message ? error.message : String(error);
            status.textContent = message;
            status.style.color = "#a23a2f";
            getInvoke()("native_pdf_failed", { error: message }).catch(function () {});
          }
        );
      } catch (error) {
        var message = error && error.message ? error.message : String(error);
        status.textContent = message;
        status.style.color = "#a23a2f";
        try {
          getInvoke()("native_pdf_failed", { error: message });
        } catch (_) {
          // The parent command reports a timeout if the bridge is unavailable.
        }
      }
    });
    actions.appendChild(saveButton);
    toolbar.appendChild(actions);

    var printStyle = document.createElement("style");
    printStyle.textContent =
      "@media print { #lexicon-pdf-toolbar { display: none !important; } }";
    document.head.appendChild(printStyle);
    document.body.insertBefore(toolbar, document.body.firstChild);
  }

  globalThis.__LEXICON_SET_PRINT_HTML__ = async function (html) {
    var invoke;

    try {
      if (typeof html !== "string" || !html.trim()) {
        throw new Error("The PDF document is empty.");
      }

      // Replace this small bootstrap page with the semantic export document.
      document.open();
      document.write(html);
      document.close();
      document.title = "Lexicon PDF Preview";

      if (document.fonts && document.fonts.ready) {
        await waitWithin(document.fonts.ready);
      }
      await Promise.all(
        Array.prototype.map.call(document.images || [], waitForImage)
      );

      // Allow layout and pagination to settle before WebView2 captures the PDF.
      await new Promise(function (resolve) {
        setTimeout(resolve, 0);
      });

      createPreviewToolbar();
      invoke = getInvoke();
      await invoke("native_pdf_preview_ready", {});
    } catch (error) {
      try {
        invoke = invoke || getInvoke();
        await invoke("native_pdf_failed", {
          error: error && error.message ? error.message : String(error),
        });
      } catch (_) {
        // The native command reports the original failure when possible.
      }
    }
  };
})();
