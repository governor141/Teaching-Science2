(function () {
  "use strict";

  var PIN_KEY = "ts_pin_v1";
  var PIN_LENGTH = 4;

  var state = {
    mode: null,          // "set" | "confirm" | "unlock" | "change-old" | "change-new" | "change-confirm"
    enteredPin: "",
    firstNewPin: "",
    currentClass: null,
    currentTerm: null
  };

  // ---------- Screen helpers ----------
  function showScreen(id) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.remove("active");
    }
    document.getElementById(id).classList.add("active");
  }

  // ---------- Storage helpers ----------
  function getSavedPin() {
    try {
      return localStorage.getItem(PIN_KEY);
    } catch (e) {
      return null;
    }
  }
  function savePin(pin) {
    try {
      localStorage.setItem(PIN_KEY, pin);
    } catch (e) {}
  }
  function clearPin() {
    try {
      localStorage.removeItem(PIN_KEY);
    } catch (e) {}
  }

  // ---------- PIN screen UI ----------
  var pinTitleEl, pinSubtitleEl, pinDotsEl, pinErrorEl, resetBtn;

  function renderDots() {
    var dots = pinDotsEl.querySelectorAll(".dot");
    for (var i = 0; i < dots.length; i++) {
      if (i < state.enteredPin.length) {
        dots[i].classList.add("filled");
      } else {
        dots[i].classList.remove("filled");
      }
    }
  }

  function showPinError(msg) {
    pinErrorEl.textContent = msg;
    pinErrorEl.classList.add("show");
    pinDotsEl.classList.add("shake");
    setTimeout(function () {
      pinDotsEl.classList.remove("shake");
    }, 400);
  }

  function hidePinError() {
    pinErrorEl.classList.remove("show");
  }

  function resetPinEntry() {
    state.enteredPin = "";
    renderDots();
  }

  function beginUnlockFlow() {
    var saved = getSavedPin();
    if (!saved) {
      state.mode = "set";
      pinTitleEl.textContent = "Create a PIN";
      pinSubtitleEl.textContent = "Choose a 4-digit PIN to secure the app";
      resetBtn.style.visibility = "hidden";
    } else {
      state.mode = "unlock";
      pinTitleEl.textContent = "Enter PIN";
      pinSubtitleEl.textContent = "Enter your 4-digit PIN to continue";
      resetBtn.style.visibility = "visible";
    }
    resetPinEntry();
    hidePinError();
    showScreen("pin-screen");
  }

  function handlePinComplete() {
    var pin = state.enteredPin;

    if (state.mode === "set") {
      state.firstNewPin = pin;
      state.mode = "confirm";
      pinTitleEl.textContent = "Confirm PIN";
      pinSubtitleEl.textContent = "Re-enter your PIN to confirm";
      hidePinError();
      resetPinEntry();
      return;
    }

    if (state.mode === "confirm") {
      if (pin === state.firstNewPin) {
        savePin(pin);
        goHome();
      } else {
        showPinError("PINs did not match. Start again.");
        setTimeout(function () {
          state.mode = "set";
          pinTitleEl.textContent = "Create a PIN";
          pinSubtitleEl.textContent = "Choose a 4-digit PIN to secure the app";
          resetPinEntry();
        }, 500);
      }
      return;
    }

    if (state.mode === "unlock") {
      var saved = getSavedPin();
      if (pin === saved) {
        goHome();
      } else {
        showPinError("Incorrect PIN. Try again.");
        resetPinEntry();
      }
      return;
    }
  }

  function goHome() {
    hidePinError();
    resetPinEntry();
    showScreen("home-screen");
  }

  // ---------- Keypad ----------
  function setupKeypad() {
    var keypad = document.getElementById("keypad");
    keypad.addEventListener("click", function (e) {
      var btn = e.target.closest(".key");
      if (!btn) return;
      var key = btn.getAttribute("data-key");

      if (key === "back") {
        state.enteredPin = state.enteredPin.slice(0, -1);
        hidePinError();
        renderDots();
        return;
      }
      if (key === "reset") {
        if (confirm("Reset your PIN? You will be asked to create a new one.")) {
          clearPin();
          beginUnlockFlow();
        }
        return;
      }
      if (/^[0-9]$/.test(key)) {
        if (state.enteredPin.length >= PIN_LENGTH) return;
        state.enteredPin += key;
        hidePinError();
        renderDots();
        if (state.enteredPin.length === PIN_LENGTH) {
          setTimeout(handlePinComplete, 120);
        }
      }
    });
  }

  // ---------- Home / navigation ----------
  var TERMS = ["First Term", "Second Term", "Third Term"];

  function setupClassCards() {
    var grid = document.getElementById("class-grid");
    grid.addEventListener("click", function (e) {
      var card = e.target.closest(".class-card");
      if (!card) return;
      openClass(card.getAttribute("data-class"));
    });
  }

  function openClass(className) {
    state.currentClass = className;
    document.getElementById("term-screen-title").textContent = className;

    var termGrid = document.getElementById("term-grid");
    termGrid.innerHTML = "";

    TERMS.forEach(function (term) {
      var btn = document.createElement("button");
      btn.className = "term-card";
      btn.setAttribute("data-term", term);
      btn.innerHTML =
        '<div>' +
          '<div class="term-card-label">' + term + '</div>' +
          '<div class="term-card-sub">Chemistry &middot; Scheme of Work</div>' +
        '</div>' +
        '<div class="term-card-arrow">&#8250;</div>';
      termGrid.appendChild(btn);
    });

    showScreen("term-screen");
  }

  function setupTermGrid() {
    var termGrid = document.getElementById("term-grid");
    termGrid.addEventListener("click", function (e) {
      var card = e.target.closest(".term-card");
      if (!card) return;
      openTerm(card.getAttribute("data-term"));
    });
  }

  function openTerm(term) {
    state.currentTerm = term;
    document.getElementById("scheme-screen-title").textContent =
      state.currentClass + " \u2014 " + term;
    document.getElementById("scheme-screen-subtitle").textContent = "Chemistry Scheme of Work";

    var listEl = document.getElementById("week-list");
    listEl.innerHTML = "";

    var weeks = [];
    try {
      weeks = SCHEME_DATA[state.currentClass]["Chemistry"][term] || [];
    } catch (e) {
      weeks = [];
    }

    if (weeks.length === 0) {
      var empty = document.createElement("div");
      empty.className = "week-card";
      empty.innerHTML = '<div class="week-topic">No content yet</div><div class="week-content">This scheme of work has not been added yet.</div>';
      listEl.appendChild(empty);
    } else {
      weeks.forEach(function (w) {
        var special = /midterm|examination|closing|break/i.test(w.topic);
        var card = document.createElement("div");
        card.className = "week-card" + (special ? " special" : "");
        var contentHTML = w.content && w.content !== "\u2014"
          ? '<div class="week-content">' + escapeHTML(w.content) + '</div>'
          : "";
        var generateBtn = "";
        if (!special) {
          generateBtn =
            '<button class="week-generate-btn" data-week="' + w.week + '">' +
              '<span class="generate-icon-sm">&#10022;</span> Generate Lesson Note' +
            '</button>';
        }
        card.innerHTML =
          '<div class="week-badge">' + w.week + '</div>' +
          '<div class="week-topic">' + escapeHTML(w.topic) + '</div>' +
          contentHTML +
          generateBtn;
        listEl.appendChild(card);
      });
    }

    showScreen("scheme-screen");
  }

  function setupWeekListClicks() {
    var listEl = document.getElementById("week-list");
    listEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".week-generate-btn");
      if (!btn) return;
      var weekNum = parseInt(btn.getAttribute("data-week"), 10);
      var weeks = SCHEME_DATA[state.currentClass]["Chemistry"][state.currentTerm] || [];
      var weekData = weeks.filter(function (w) { return w.week === weekNum; })[0];
      if (!weekData) return;
      if (window.TSNote && window.TSNote.open) {
        window.TSNote.open({
          className: state.currentClass,
          term: state.currentTerm,
          subject: "Chemistry",
          week: weekData.week,
          topic: weekData.topic,
          content: weekData.content
        });
      }
    });
  }

  function escapeHTML(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Back buttons / lock ----------
  function setupBackButtons() {
    document.getElementById("term-back-btn").addEventListener("click", function () {
      showScreen("home-screen");
    });
    document.getElementById("scheme-back-btn").addEventListener("click", function () {
      showScreen("term-screen");
    });
    document.getElementById("lock-btn").addEventListener("click", function () {
      beginUnlockFlow();
    });
    document.getElementById("settings-btn").addEventListener("click", function () {
      showScreen("settings-screen");
      if (window.TSNote && window.TSNote.onSettingsOpen) {
        window.TSNote.onSettingsOpen();
      }
    });
    document.getElementById("settings-back-btn").addEventListener("click", function () {
      showScreen("home-screen");
    });
    document.getElementById("note-back-btn").addEventListener("click", function () {
      showScreen("scheme-screen");
    });
  }

  // ---------- Android hardware back button support ----------
  window.addEventListener("ts:back", function () {
    var active = document.querySelector(".screen.active");
    if (!active) return;
    var id = active.id;
    if (id === "note-screen") {
      showScreen("scheme-screen");
    } else if (id === "settings-screen") {
      showScreen("home-screen");
    } else if (id === "scheme-screen") {
      showScreen("term-screen");
    } else if (id === "term-screen") {
      showScreen("home-screen");
    }
    // home-screen and pin-screen: let native handle exit
  });

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", function () {
    pinTitleEl = document.getElementById("pin-title");
    pinSubtitleEl = document.getElementById("pin-subtitle");
    pinDotsEl = document.getElementById("pin-dots");
    pinErrorEl = document.getElementById("pin-error");
    resetBtn = document.getElementById("pin-reset-btn");

    setupKeypad();
    setupClassCards();
    setupTermGrid();
    setupWeekListClicks();
    setupBackButtons();

    setTimeout(function () {
      beginUnlockFlow();
    }, 2200);
  });
})();
