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
    add(box, "p", "1. Put this code on your page at " + proofUrl + ". Anywhere on the page works. The strongest proof is a meta tag named opencampingdb-claim in the head of the page, with the code as its content. You can take it down once your claim is approved.");
    add(box, "span", answer.code, "secret");
    copyButton(box, answer.code, "Copy the code");
    add(box, "p", "2. Save this token somewhere safe, such as a password manager. You need it to update your place later. It is shown only now, and we cannot show it again.");
    add(box, "span", answer.token, "secret");
    copyButton(box, answer.token, "Copy the token");
    add(box, "p", "We check your page several times a day for 7 days. Once the code is there, a person reviews your claim, usually within a few days. Your reference is " + answer.id + ".");
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
    if ((kind === "claim" || kind === "update") && !body.place) {
      showErrors(status, "Please find and choose your place.");
      return;
    }
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

  // Kinds of place, in the words owners use.
  var KINDS = {
    campground: "Campground",
    paid_campground: "Paid campground",
    free_camp: "Free camp",
    national_park_campsite: "National park campsite",
    state_forest_campsite: "State forest campsite",
    caravan_park: "Caravan park",
    farm_stay: "Farm stay",
    showground: "Showground",
    rest_area: "Rest area",
    long_vehicle_parking: "Long vehicle parking",
    roofed_accommodation: "Cabins and rooms",
    backpacker_hostel: "Hostel",
    food_and_drink: "Food and drink",
    fuel: "Fuel",
    lpg_refill_swap: "LPG",
    mechanic: "Mechanic",
    dump_point: "Dump point",
    picnic_site: "Picnic area",
    information_centre: "Information centre",
  };

  function kindLabel(kind) {
    if (KINDS[kind]) return KINDS[kind];
    var words = String(kind || "").replace(/_/g, " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  // The same words scripts/build_place_search.py files a name under.
  function searchWords(text) {
    return String(text)
      .normalize("NFKD")
      .replace(/[^\x00-\x7f]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(function (w) {
        return w.length >= 2 || /^[0-9]$/.test(w);
      });
  }

  var searchFiles = {};

  // One file of the place search: every named place with a word starting with key.
  function searchFile(key) {
    if (!searchFiles[key]) {
      searchFiles[key] = fetch("search/" + key + ".json").then(function (res) {
        if (res.status === 404) return [];
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      });
      searchFiles[key].catch(function () {
        delete searchFiles[key];
      });
    }
    return searchFiles[key];
  }

  // Places whose name has a word starting with each word typed. The state
  // ("vic") and the postcode also count, so "sambell vic" finds Lake Sambell.
  function matches(entries, words) {
    return entries.filter(function (e) {
      var own = searchWords(e[1]);
      return words.every(function (w) {
        if (w === String(e[3]).toLowerCase() || (e[4] && String(e[4]).indexOf(w) === 0)) return true;
        return own.some(function (o) {
          return o.indexOf(w) === 0;
        });
      });
    });
  }

  function rank(list, words) {
    var typed = words.join(" ");
    return list
      .map(function (e) {
        var own = searchWords(e[1]).join(" ");
        var score = own === typed ? 0 : own.indexOf(typed) === 0 ? 1 : own.indexOf(words[0]) === 0 ? 2 : 3;
        return { e: e, score: score };
      })
      .sort(function (a, b) {
        return a.score - b.score || a.e[1].localeCompare(b.e[1]);
      })
      .map(function (x) {
        return x.e;
      });
  }

  var SHOWN = 25;
  var STATES = ["nsw", "vic", "qld", "sa", "wa", "tas", "nt", "act"];

  function placeSearch(form) {
    var box = document.getElementById("place-search");
    if (!box) return null;
    var list = document.getElementById("place-results");
    var status = document.getElementById("place-results-status");
    var finder = document.getElementById("place-finder");
    var picked = document.getElementById("place-picked");
    var pickedName = document.getElementById("place-picked-name");
    var pickedDetail = document.getElementById("place-picked-detail");
    var field = form.elements.namedItem("place");
    var timer = null;
    var asked = 0;

    function detail(e) {
      return [kindLabel(e[2]), [e[3], e[4]].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    }

    function pick(id, name, text, quiet) {
      field.value = id;
      pickedName.textContent = name;
      pickedDetail.textContent = text;
      finder.hidden = true;
      picked.hidden = false;
      if (!quiet) picked.querySelector("button").focus();
    }

    function change() {
      field.value = "";
      picked.hidden = true;
      finder.hidden = false;
      box.focus();
    }

    function show(found, words) {
      clear(list);
      if (!found.length) {
        status.textContent = "No place with that name. Check the spelling, or try fewer words.";
        return;
      }
      found.slice(0, SHOWN).forEach(function (e) {
        var item = add(list, "li");
        var button = add(item, "button", "", "result");
        button.type = "button";
        add(button, "strong", e[1]);
        add(button, "span", detail(e));
        button.addEventListener("click", function () {
          pick(e[0], e[1], detail(e));
        });
        var map = add(item, "a", "Map", "map");
        map.href = "https://www.openstreetmap.org/?mlat=" + e[5] + "&mlon=" + e[6] + "#map=15/" + e[5] + "/" + e[6];
        map.target = "_blank";
        map.rel = "noopener noreferrer";
        map.setAttribute("aria-label", "Map of " + e[1]);
      });
      status.textContent =
        found.length > SHOWN ? "Showing " + SHOWN + " of " + found.length + " places. Type more of the name to narrow it down." : found.length === 1 ? "1 place found." : found.length + " places found.";
    }

    function search() {
      var words = searchWords(box.value);
      var mine = ++asked;
      if (!words.length) {
        clear(list);
        status.textContent = "";
        return;
      }
      // Fetch the file for the longest word of the name, the one with the
      // fewest places. A state or a postcode is only a filter.
      var nameWords = words.filter(function (w) {
        return STATES.indexOf(w) < 0 && !/^[0-9]{4}$/.test(w);
      });
      var keys = (nameWords.length ? nameWords : words)
        .slice()
        .sort(function (a, b) {
          return b.length - a.length;
        })
        .map(function (w) {
          return w.slice(0, 3);
        });
      status.textContent = "Searching...";
      searchFile(keys[0])
        .then(function (entries) {
          if (mine !== asked) return;
          show(rank(matches(entries, words), words), words);
        })
        .catch(function () {
          if (mine !== asked) return;
          clear(list);
          status.textContent = "We could not load the place search. Check your connection and try again.";
        });
    }

    box.addEventListener("input", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(search, 200);
    });
    picked.querySelector("button").addEventListener("click", change);

    return {
      // A place id from the app's link: shown as chosen, without a name.
      prefilled: function (id) {
        pick(id, "Your place", id, true);
      },
      reset: function () {
        field.value = "";
        box.value = "";
        clear(list);
        status.textContent = "";
        picked.hidden = true;
        finder.hidden = false;
      },
    };
  }

  function start() {
    var form = document.querySelector("form[data-kind]");
    if (!form) return;
    var kind = form.getAttribute("data-kind");

    // Fill in the place id when an app links here with ?place=ocdb_...
    var params = new URLSearchParams(window.location.search);
    var place = params.get("place");
    var placeField = form.elements.namedItem("place");
    var finder = placeSearch(form);
    var prefill = function () {
      if (finder) finder.reset();
      if (place && placeField && /^ocdb_[0-9A-HJKMNP-TV-Z]{26}$/.test(place)) {
        placeField.value = place;
        if (finder) finder.prefilled(place);
      }
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
