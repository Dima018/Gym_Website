import { api, token, logout } from "./api.js";
const $ = (s) => document.querySelector(s);
const money = (n) =>
  new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" }).format(
    n / 100,
  );
function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function link(text, href, cls) {
  const e = el("a", text, cls);
  e.href = href;
  return e;
}
function status(text = "", type = "") {
  if ($("#status")) {
    $("#status").textContent = text;
    $("#status").className = type;
  }
}
function error(e) {
  status(
    e.message +
      (e.fields
        ? " " + e.fields.map((f) => f.field + ": " + f.message).join("; ")
        : ""),
    "error",
  );
}
async function busy(form, fn) {
  const button = form.querySelector("button[type=submit],button:not([type])");
  if (button) button.disabled = true;
  try {
    await fn();
  } catch (e) {
    error(e);
  } finally {
    if (button) button.disabled = false;
  }
}
function card(t) {
  const a = el("article", undefined, "card training-card");
  const img = el("img");
  img.src = "assets/" + t.image;
  img.alt = t.name;
  img.width = 600;
  img.height = 320;
  const b = el("div", undefined, "card-body");
  b.append(
    el("p", t.category_name + " · " + t.duration_minutes + " хв", "eyebrow"),
    el("h2", t.name),
    el("p", t.description),
    el("p", money(t.price_cents), "price"),
    link("Детальніше →", "strength-training.html?id=" + t.id),
  );
  a.append(img, b);
  return a;
}
async function catalog() {
  status("Завантажуємо тренування…");
  if ($("#retry")) $("#retry").hidden = true;
  try {
    const category = $("#category-filter")?.value;
    const { data } = await api(
      "/trainings" +
        (category ? "?category_id=" + encodeURIComponent(category) : ""),
    );
    const target = $("#catalog") || $("#home-trainings");
    target.replaceChildren(
      ...(target.id === "home-trainings" ? data.slice(0, 3) : data).map(card),
    );
    status(data.length ? "" : "У цьому напрямі ще немає тренувань.");
  } catch (e) {
    error(e);
    if ($("#retry")) $("#retry").hidden = false;
  }
}
async function detail() {
  status("Завантажуємо тренування…");
  $("#retry").hidden = true;
  try {
    const id = new URLSearchParams(location.search).get("id") || "1";
    const { data: t } = await api("/trainings/" + encodeURIComponent(id));
    $("#training-title").textContent = t.name;
    document.title = t.name + " — Ритм";
    const box = el("div", undefined, "two-columns");
    const img = el("img");
    img.src = "assets/" + t.image;
    img.alt = t.name;
    img.width = 600;
    img.height = 320;
    const body = el("div");
    body.append(
      el("p", t.category_name, "eyebrow"),
      el("p", t.description, "lead"),
      el("p", `${money(t.price_cents)} / ${t.duration_minutes} хв`, "price"),
      link("Записатися →", "training-signup.html?training=" + t.id, "button"),
    );
    box.append(img, body);
    $("#training-detail").replaceChildren(box);
    status();
  } catch (e) {
    error(e);
    $("#retry").hidden = false;
  }
}
async function signup() {
  status("Завантажуємо форму…");
  if (!token()) {
    $("#login-needed").hidden = false;
    status();
    return;
  }
  try {
    await api("/auth/me");
    const { data } = await api("/trainings");
    const select = $("#training");
    select.replaceChildren(
      new Option("Оберіть тренування", ""),
      ...data.map(
        (t) => new Option(t.name + " — " + money(t.price_cents), t.id),
      ),
    );
    const params = new URLSearchParams(location.search);
    select.value = params.get("training") || "";
    const today = new Date().toISOString().slice(0, 10),
      end = new Date();
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    $("#session-date").min = today;
    $("#session-date").max = end.toISOString().slice(0, 10);
    $("#session-date").value = today;
    const edit = params.get("edit");
    if (edit) {
      const { data: b } = await api("/bookings/" + encodeURIComponent(edit));
      select.value = b.training_id;
      $("#session-date").value = b.session_date;
      $("#phone").value = b.phone;
      $("#note").value = b.note;
      $("#signup-title").textContent = "Змінити запис";
    }
    $("#booking-form").hidden = false;
    status(data.length ? "" : "Тренувань поки немає.");
    $("#booking-form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.target, async () => {
        const d = Object.fromEntries(new FormData(e.target));
        d.training_id = Number(d.training_id);
        await api("/bookings" + (edit ? "/" + encodeURIComponent(edit) : ""), {
          method: edit ? "PATCH" : "POST",
          body: d,
        });
        location.href = "account.html?saved=1";
      });
    };
  } catch (e) {
    error(e);
    if (e.status === 401) $("#login-needed").hidden = false;
  }
}
async function account() {
  for (const action of ["login", "register"])
    $("#" + action + "-form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.target, async () => {
        status("Перевіряємо дані…");
        const d = await api("/auth/" + action, {
          method: "POST",
          body: Object.fromEntries(new FormData(e.target)),
        });
        sessionStorage.setItem("ritm_token", d.token);
        e.target.reset();
        await profile();
      });
    };
  $("#logout").onclick = () => {
    logout();
    location.href = "account.html";
  };
  if (token()) await profile();
}
async function profile() {
  status("Завантажуємо ваші записи…");
  try {
    const { data: user } = await api("/auth/me");
    $("#auth-forms").hidden = true;
    $("#profile").hidden = false;
    $("#user-name").textContent = "Вітаємо, " + user.name + "!";
    $("#admin-link").hidden = user.role !== "admin";
    const { data } = await api("/bookings");
    $("#bookings").replaceChildren();
    for (const b of data) {
      const c = el("article", undefined, "card");
      c.append(
        el("h3", b.training_name),
        el("p", b.session_date + " · " + money(b.price_cents)),
        el("p", b.phone),
        el("p", b.note),
      );
      const actions = el("div", undefined, "card-actions");
      const del = el("button", "Скасувати", "button secondary");
      del.onclick = async () => {
        if (!confirm("Скасувати цей запис?")) return;
        del.disabled = true;
        try {
          await api("/bookings/" + b.id, { method: "DELETE" });
          await profile();
          status("Запис скасовано.", "success");
        } catch (e) {
          error(e);
          del.disabled = false;
        }
      };
      actions.append(link("Змінити", "training-signup.html?edit=" + b.id), del);
      c.append(actions);
      $("#bookings").append(c);
    }
    status(
      data.length
        ? new URLSearchParams(location.search).has("saved")
          ? "Запис збережено."
          : ""
        : "Записів поки немає. Оберіть тренування в каталозі.",
      "success",
    );
  } catch (e) {
    error(e);
    if (e.status === 401) {
      $("#auth-forms").hidden = false;
      $("#profile").hidden = true;
    }
  }
}
async function admin() {
  status("Перевіряємо доступ…");
  try {
    const { data: u } = await api("/auth/me");
    if (u.role !== "admin") {
      $("#admin-denied").hidden = false;
      status();
      return;
    }
    $("#admin-content").hidden = false;
    const { data: categories } = await api("/categories");
    $("#category").replaceChildren(
      ...categories.map((c) => new Option(c.name, c.id)),
    );
    let editing = null;
    const form = $("#training-form");
    function reset() {
      editing = null;
      form.reset();
      $("#editor-title").textContent = "Нове тренування";
    }
    $("#reset-editor").onclick = reset;
    async function refresh() {
      const { data } = await api("/trainings");
      $("#admin-list").replaceChildren();
      for (const t of data) {
        const c = el("article", undefined, "card");
        c.append(
          el("h3", t.name),
          el("p", t.category_name + " · " + money(t.price_cents)),
        );
        const actions = el("div", undefined, "card-actions");
        const edit = el("button", "Редагувати", "button secondary"),
          del = el("button", "Видалити", "button secondary");
        edit.onclick = () => {
          editing = t.id;
          for (const key of [
            "name",
            "description",
            "category_id",
            "duration_minutes",
            "image",
          ])
            form.elements[key].value = t[key];
          form.elements.price.value = t.price_cents / 100;
          $("#editor-title").textContent = "Редагувати тренування";
          form.scrollIntoView({ behavior: "smooth" });
        };
        del.onclick = async () => {
          if (
            !confirm(
              "Видалити тренування? За наявності записів видалення неможливе.",
            )
          )
            return;
          del.disabled = true;
          try {
            await api("/trainings/" + t.id, { method: "DELETE" });
            if (editing === t.id) reset();
            await refresh();
            status("Тренування видалено.", "success");
          } catch (e) {
            error(e);
            del.disabled = false;
          }
        };
        actions.append(edit, del);
        c.append(actions);
        $("#admin-list").append(c);
      }
    }
    form.onsubmit = (e) => {
      e.preventDefault();
      busy(form, async () => {
        const d = Object.fromEntries(new FormData(form));
        d.category_id = Number(d.category_id);
        d.duration_minutes = Number(d.duration_minutes);
        d.price_cents = Math.round(Number(d.price) * 100);
        delete d.price;
        await api("/trainings" + (editing ? "/" + editing : ""), {
          method: editing ? "PATCH" : "POST",
          body: d,
        });
        reset();
        await refresh();
        status("Тренування збережено.", "success");
      });
    };
    await refresh();
    status();
  } catch (e) {
    error(e);
    if (e.status === 401 || e.status === 403) $("#admin-denied").hidden = false;
  }
}
async function init() {
  if ($("#catalog") || $("#home-trainings")) {
    if ($("#category-filter")) {
      try {
        const { data } = await api("/categories");
        $("#category-filter").append(
          ...data.map((c) => new Option(c.name, c.id)),
        );
      } catch (e) {
        error(e);
      }
      $("#category-filter").onchange = catalog;
      $("#retry").onclick = catalog;
    }
    await catalog();
  }
  if ($("#training-detail")) {
    $("#retry").onclick = detail;
    await detail();
  }
  if ($("#booking-form")) await signup();
  if ($("#auth-forms")) await account();
  if ($("#training-form")) await admin();
}
init().catch(error);
