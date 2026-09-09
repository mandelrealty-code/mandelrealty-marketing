(function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolve(expr, data, scope) {
    expr = String(expr || "").trim();
    if (expr === "true") return true;
    if (expr === "false") return false;
    if (!expr) return "";
    var parts = expr.split(".");
    var cur;
    if (scope && Object.prototype.hasOwnProperty.call(scope, parts[0])) cur = scope[parts[0]];
    else cur = data[parts[0]];
    for (var i = 1; i < parts.length; i++) {
      if (cur == null) return "";
      cur = cur[parts[i]];
    }
    return cur === undefined || cur === null ? "" : cur;
  }

  function findMatchingClose(html, tag, fromIdx) {
    var tokenRe = new RegExp("<(/)?" + tag + "\\b[^>]*>", "g");
    tokenRe.lastIndex = fromIdx;
    var depth = 0;
    var m;
    while ((m = tokenRe.exec(html))) {
      if (m[1]) {
        depth--;
        if (depth === 0) return { start: m.index, end: m.index + m[0].length };
      } else {
        depth++;
      }
    }
    return null;
  }

  function interpolate(html, data, scope) {
    html = html.replace(/\s+hint-placeholder-[a-z-]+=\"[^\"]*\"/g, "");
    html = html.replace(/\sonClick=\"\{\{\s*([^}]+?)\s*\}\}\"/g, ' data-dc-click="$1"');
    html = html.replace(/\sonChange=\"\{\{\s*([^}]+?)\s*\}\}\"/g, ' data-dc-change="$1"');
    html = html.replace(/\sstyle-hover=\"([^\"]*)\"/g, ' data-style-hover="$1"');
    return html.replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (_, expr) {
      var v = resolve(expr, data, scope);
      if (typeof v === "function") return "";
      if (typeof v === "boolean") return v ? "true" : "";
      return escapeHtml(v);
    });
  }

  function process(html, data, scope) {
    var out = "";
    var i = 0;
    while (i < html.length) {
      var nextFor = html.indexOf("<sc-for", i);
      var nextIf = html.indexOf("<sc-if", i);
      var next = -1;
      var kind = null;
      if (nextFor === -1 && nextIf === -1) {
        out += interpolate(html.slice(i), data, scope);
        break;
      }
      if (nextFor === -1 || (nextIf !== -1 && nextIf < nextFor)) {
        next = nextIf;
        kind = "sc-if";
      } else {
        next = nextFor;
        kind = "sc-for";
      }
      out += interpolate(html.slice(i, next), data, scope);
      var gt = html.indexOf(">", next);
      if (gt === -1) {
        out += html.slice(next);
        break;
      }
      var openTag = html.slice(next, gt + 1);
      var close = findMatchingClose(html, kind, next);
      if (!close) {
        out += openTag;
        i = gt + 1;
        continue;
      }
      var inner = html.slice(gt + 1, close.start);
      if (kind === "sc-if") {
        var vm = openTag.match(/value=\"\{\{\s*([^}]+?)\s*\}\}\"/);
        var val = vm ? resolve(vm[1], data, scope) : false;
        if (val) out += process(inner, data, scope);
      } else {
        var lm = openTag.match(/list=\"\{\{\s*([^}]+?)\s*\}\}\"/);
        var am = openTag.match(/\sas=\"([^\"]+)\"/);
        var list = lm ? resolve(lm[1], data, scope) : [];
        var as = am ? am[1] : "item";
        var arr = Array.isArray(list) ? list : [];
        for (var j = 0; j < arr.length; j++) {
          var childScope = Object.assign({}, scope);
          childScope[as] = arr[j];
          out += process(inner, data, childScope);
        }
      }
      i = close.end;
    }
    return out;
  }

  function unescapeStyles(html) {
    return html.replace(/style=\"([^\"]*)\"/g, function (_, css) {
      var u = css
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
      return 'style="' + u.replace(/"/g, "&quot;") + '"';
    });
  }

  function bindHovers(root) {
    root.querySelectorAll("[data-style-hover]").forEach(function (el) {
      var hover = el.getAttribute("data-style-hover") || "";
      var base = el.getAttribute("style") || "";
      el.addEventListener("mouseenter", function () {
        var map = {};
        (base + ";" + hover).split(";").forEach(function (part) {
          var idx = part.indexOf(":");
          if (idx === -1) return;
          var k = part.slice(0, idx).trim();
          var v = part.slice(idx + 1).trim();
          if (k) map[k] = v;
        });
        el.setAttribute(
          "style",
          Object.keys(map)
            .map(function (k) {
              return k + ": " + map[k];
            })
            .join("; ")
        );
      });
      el.addEventListener("mouseleave", function () {
        el.setAttribute("style", base);
      });
    });
  }

  function bindEvents(root, data) {
    root.querySelectorAll("[data-dc-click]").forEach(function (el) {
      var name = el.getAttribute("data-dc-click");
      var fn = data[name];
      if (typeof fn === "function") {
        el.addEventListener("click", function (e) {
          e.preventDefault();
          fn(e);
        });
      }
    });
    root.querySelectorAll("[data-dc-change]").forEach(function (el) {
      var name = el.getAttribute("data-dc-change");
      var fn = data[name];
      if (typeof fn === "function") {
        el.addEventListener("input", function (e) {
          fn(e);
        });
        el.addEventListener("change", function (e) {
          fn(e);
        });
      }
    });
  }

  function restoreFields(root, vals) {
    if (!vals) return;
    Object.keys(vals).forEach(function (name) {
      var el = root.querySelector('[name="' + name + '"]');
      if (!el) return;
      if (el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        el.value = vals[name] == null ? "" : String(vals[name]);
      }
    });
  }

  class DCLogic {
    constructor(root, template, props) {
      this.root = root;
      this.template = template;
      this.props = props || {};
      this.state = {};
      this.vals = {};
    }
    setState(patch, cb) {
      var next = typeof patch === "function" ? patch(this.state) : patch;
      Object.assign(this.state, next);
      this.render();
      if (typeof cb === "function") cb();
    }
    render() {
      var y = window.scrollY;
      var active = document.activeElement;
      var activeName = active && active.getAttribute && active.getAttribute("name");
      var selStart = active && active.selectionStart;
      var selEnd = active && active.selectionEnd;
      var data = this.renderVals();
      var html = unescapeStyles(process(this.template, data, {}));
      this.root.innerHTML = html;
      bindEvents(this.root, data);
      bindHovers(this.root);
      restoreFields(this.root, this.vals);
      if (activeName) {
        var el = this.root.querySelector('[name="' + activeName + '"]');
        if (el) {
          el.focus();
          try {
            if (selStart != null) el.setSelectionRange(selStart, selEnd);
          } catch (_) {}
        }
      }
      window.scrollTo(0, y);
    }
    mount() {
      this.render();
    }
  }

  globalThis.DCLogic = DCLogic;
  if (typeof window !== "undefined") window.DCLogic = DCLogic;
})();
