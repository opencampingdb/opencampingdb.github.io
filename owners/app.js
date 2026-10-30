// Owner pages for Open Camping DB. No libraries and no trackers: this script
// only reads the forms and posts them to the intake named in config.js.
(function () {
  "use strict";

  var config = window.OCDB_CONFIG || {};
  var DEVICE_KEY = "ocdb.owner.device";
  var BOOLEAN_FACTS = ["fee", "power", "tents", "caravans", "toilets", "showers", "drinking_water", "dump_station"];

  function randomUUID() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = Array.prototype.map
      .call(bytes, function (b) {
        return (b < 16 ? "0" : "") + b.toString(16);
      })
      .join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
  }

  // A random id for this browser, used only for the daily limit.
  function deviceId() {
    try {
      var existing = window.localStorage.getItem(DEVICE_KEY);
      if (existing) return existing;
      var id = randomUUID();
      window.localStorage.setItem(DEVICE_KEY, id);
      return id;
    } catch (e) {
      return randomUUID();
    }
  }

  function value(form, name) {
    var el = form.elements.namedItem(name);
    return el && typeof el.value === "string" ? el.value.trim() : "";
  }

  function checked(form, name) {
    var el = form.elements.namedItem(name);
    return Boolean(el && el.checked);
  }

  function number(form, name) {
    var text = value(form, name);
    return text === "" ? NaN : Number(text);
  }

  // Facts from the select boxes. "" means not given (or no change).
  function facts(form) {
    var out = {};
    BOOLEAN_FACTS.forEach(function (name) {
      var v = value(form, "fact_" + name);
      if (v === "yes") out[name] = true;
      if (v === "no") out[name] = false;
    });
    ["pets", "entry"].forEach(function (name) {
      var v = value(form, "fact_" + name);
      if (v) out[name] = v;
    });
    ["max_stay", "opening_hours", "phone", "website", "booking_url"].forEach(function (name) {
      var v = value(form, "fact_" + name);
      if (v) out[name] = v;
    });
    return out;
  }

  function base(form, type) {
    return {
      type: type,
      device: deviceId(),
      app_version: config.appVersion || "owner-page-1.0.0",
      terms_accepted: checked(form, "terms"),
    };
  }

  function location(form) {
    var lat = number(form, "lat");
    var lon = number(form, "lon");
    if (isNaN(lat) && isNaN(lon)) return undefined;
    return { lat: lat, lon: lon };
  }

  var builders = {
    claim: function (form) {
      var body = base(form, "owner_claim");
      body.place = value(form, "place");
      body.owner = { name: value(form, "owner_name"), email: value(form, "owner_email") };
      body.claim = { proof_url: value(form, "proof_url") };
      return body;
    },
    list: function (form) {
      var body = base(form, "owner_listing");
      body.place = null;
      body.location = location(form);
      body.owner = { name: value(form, "owner_name"), email: value(form, "owner_email") };
      body.claim = { proof_url: value(form, "proof_url") };
      body.listing = { name: value(form, "listing_name"), facts: facts(form) };
      var description = value(form, "description");
      if (description) body.listing.description = description;
      return body;
    },
    update: function (form) {
      var body = base(form, "owner_update");
      body.place = value(form, "place");
      body.token = value(form, "token");
      var update = {};
      var f = facts(form);
      if (Object.keys(f).length) update.facts = f;
      if (checked(form, "remove_description")) update.description = "";
      else if (value(form, "description")) update.description = value(form, "description");
      var status = value(form, "status");
      if (status) update.status = status;
      if (status === "temporarily_closed") update.reopens = value(form, "reopens");
      if (value(form, "new_name")) update.name = value(form, "new_name");
      var loc = location(form);
      if (loc) update.location = loc;
      body.update = update;
      return body;
    },
  };

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function add(parent, tag, text, className) {
    var el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    parent.appendChild(el);
    return el;
  }

  function showErrors(status, title, details) {
    clear(status);
    var box = add(status, "div", "", "error");
    add(box, "p", title);
    if (details && details.length) {
      var list = add(box, "ul");
      details.forEach(function (d) {
        add(list, "li", d);
      });
    }
    box.setAttribute("tabindex", "-1");
    box.focus();
  }

  function copyButton(parent, text, label) {
    var button = add(parent, "button", label, "secondary");
    button.type = "button";
    button.addEventListener("click", function () {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          button.textContent = "Copied";
        });
      }
    });
  }

  function showClaimResult(status, answer, proofUrl) {
    clear(status);
    var box = add(status, "div", "", "ok");
    add(box, "h2", "Thank you. Two more steps");
    add(box, "p", "1. Put this code on your page at " + proofUrl + ". Anywhere on the page is fine, and you can take it down once your claim is approved.");
    add(box, "span", answer.code, "secret");
    copyButton(box, answer.code, "Copy the code");
    add(box, "p", "2. Save this token somewhere safe, such as a password manager. You need it to update your place later. It is shown only now, and we cannot show it again.");
    add(box, "span", answer.token, "secret");
    copyButton(box, answer.token, "Copy the token");
    add(box, "p", "We check your page every hour for 7 days. Once the code is there, a person reviews your claim, usually within a few days. Your reference is " + answer.id + ".");
    box.setAttribute("tabindex", "-1");
    box.focus();
  }

  function showUpdateResult(status, answer) {
    clear(status);
    var box = add(status, "div", "", "ok");
    add(box, "h2", "Update received");
    add(box, "p", "Most changes appear within a day. A new name or location is checked by a person first. Your reference is " + answer.id + ".");
    box.setAttribute("tabindex", "-1");
    box.focus();
  }

  function submit(form, kind) {
    var status = document.getElementById("form-status");
    var button = form.querySelector("button[type=submit]");
    var body = builders[kind](form);
    if (!body.terms_accepted) {
      showErrors(status, "Please tick the box to agree to the owner terms.");
      return;
    }
    if (!config.appKey || config.appKey.indexOf("REPLACE_") === 0) {
      showErrors(status, "This page is not set up yet. Please try again later.");
      return;
    }
    button.disabled = true;
    fetch(config.intake, {
      method: "POST",
      headers: { "content-type": "application/json", "x-app-key": config.appKey },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (answer) {
            if (res.status === 202) {
              if (kind === "update") showUpdateResult(status, answer);
              else showClaimResult(status, answer, body.claim.proof_url);
              form.reset();
              return;
            }
            if (res.status === 400) showErrors(status, "Please check these and try again:", answer.details || []);
            else if (res.status === 429) showErrors(status, "You have sent 5 owner forms today. Please try again tomorrow.");
            else showErrors(status, "Something went wrong (" + res.status + "). Please try again in a few minutes.");
          });
      })
      .catch(function () {
        showErrors(status, "We could not reach Open Camping DB. Check your connection and try again.");
      })
      .then(function () {
        button.disabled = false;
      });
  }

  function useMyLocation(form) {
    var status = document.getElementById("location-status");
    if (!navigator.geolocation) {
      status.textContent = "This browser cannot share its location. Please type the latitude and longitude.";
      return;
    }
    status.textContent = "Finding your location...";
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        form.elements.namedItem("lat").value = pos.coords.latitude.toFixed(6);
        form.elements.namedItem("lon").value = pos.coords.longitude.toFixed(6);
        status.textContent = "Location filled in. Check it is where guests stay, not just where you are now.";
      },
      function () {
        status.textContent = "We could not get your location. Please type the latitude and longitude.";
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function start() {
    var form = document.querySelector("form[data-kind]");
    if (!form) return;
    var kind = form.getAttribute("data-kind");

    // Fill in the place id when an app links here with ?place=ocdb_...
    var params = new URLSearchParams(window.location.search);
    var place = params.get("place");
    var placeField = form.elements.namedItem("place");
    var prefill = function () {
      if (place && placeField && /^ocdb_[0-9A-HJKMNP-TV-Z]{26}$/.test(place)) placeField.value = place;
    };
    prefill();

    var locate = document.getElementById("use-location");
    if (locate) {
      locate.addEventListener("click", function () {
        useMyLocation(form);
      });
    }

    var statusSelect = form.elements.namedItem("status");
    var reopens = document.getElementById("reopens-field");
    var toggle = function () {
      if (!statusSelect || !reopens) return;
      reopens.hidden = statusSelect.value !== "temporarily_closed";
      form.elements.namedItem("reopens").required = !reopens.hidden;
    };
    if (statusSelect) statusSelect.addEventListener("change", toggle);
    toggle();

    // After a successful send the form is cleared. Put back the place id from
    // the link and hide the reopening date again.
    form.addEventListener("reset", function () {
      window.setTimeout(function () {
        prefill();
        toggle();
      }, 0);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submit(form, kind);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
