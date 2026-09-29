"use strict";


/* =====================================================
   CONFIGURACIÓN
===================================================== */

const STORAGE_PREFIX = "postit-app-";

const NOTEBOOK_STORAGE =
    "postit-app-notebook";


/* =====================================================
   PESTAÑAS
===================================================== */

const tabButtons =
    document.querySelectorAll(".tab-button");

const tabViews =
    document.querySelectorAll(".tab-view");


const MY_NOTES_USER_STORAGE = "postit-app-my-notes-user";
let currentMyNotesUser = sessionStorage.getItem(MY_NOTES_USER_STORAGE) || "";

function askMyNotesUser(force = false) {
    if (currentMyNotesUser && !force) return true;
    const entered = window.prompt("¿Quién eres?");
    if (entered === null) return Boolean(currentMyNotesUser);
    const name = entered.trim();
    if (!name) {
        window.alert("Escribe tu nombre para ver tus notas.");
        return false;
    }
    currentMyNotesUser = name;
    sessionStorage.setItem(MY_NOTES_USER_STORAGE, name);
    renderMyNotes();
    return true;
}

function showTab(selectedTab) {
    tabButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.tab === selectedTab));
    tabViews.forEach(view => view.classList.remove("active"));

    if (selectedTab === "postits") {
        document.getElementById("postits-view").classList.add("active");
    } else if (selectedTab === "notebook") {
        document.getElementById("notebook-view").classList.add("active");
        renderNotebook();
    } else if (selectedTab === "my-notes") {
        if (!askMyNotesUser()) {
            showTab("postits");
            return;
        }
        document.getElementById("my-notes-view").classList.add("active");
        renderMyNotes();
    }
}

tabButtons.forEach(button => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
});

const changeUserButton = document.getElementById("change-my-notes-user");
if (changeUserButton) {
    changeUserButton.addEventListener("click", () => {
        currentMyNotesUser = "";
        sessionStorage.removeItem(MY_NOTES_USER_STORAGE);
        if (askMyNotesUser(true)) renderMyNotes();
    });
}

function getPersonalNotesKey() {
    return "postit-app-personal-notes-" + (currentMyNotesUser || "").trim().toLocaleLowerCase();
}

function getPersonalNotes() {
    try {
        const value = JSON.parse(localStorage.getItem(getPersonalNotesKey()) || "[]");
        return Array.isArray(value) ? value : [];
    } catch { return []; }
}

function savePersonalNotes(notes) {
    localStorage.setItem(getPersonalNotesKey(), JSON.stringify(notes));
}

function renderMyNotes() {
    const grid = document.getElementById("my-notes-grid");
    const welcome = document.getElementById("my-notes-welcome");
    const empty = document.getElementById("my-notes-empty");
    if (!grid || !welcome || !empty) return;

    welcome.textContent = currentMyNotesUser ? `Bienvenido ${currentMyNotesUser}` : "Mis notas";
    grid.innerHTML = "";

    const normalizeName = value => (value || "").trim().toLocaleLowerCase();
    const currentUser = normalizeName(currentMyNotesUser);
    const assigned = [...document.querySelectorAll(".note.urgent[data-storage], .note.important[data-storage]")]
        .filter(note => normalizeName(note.querySelector(".recipient-input")?.value) === currentUser && currentUser);

    assigned.forEach(source => {
        const clone = source.cloneNode(true);
        clone.classList.remove("urgent-1", "urgent-2", "urgent-3", "important-1", "important-2", "important-3");
        clone.classList.add("my-note-card");
        clone.removeAttribute("data-storage");
        clone.querySelector(".delete-note")?.remove();
        clone.querySelectorAll("input, .note-content").forEach(el => {
            el.setAttribute("readonly", "readonly");
            el.setAttribute("contenteditable", "false");
            if ("disabled" in el) el.disabled = true;
        });
        grid.appendChild(clone);
    });

    // Cada usuario dispone de cuatro Post-it personales, guardados independientemente.
    const personal = getPersonalNotes();
    while (personal.length < 4) personal.push("");
    personal.slice(0, 4).forEach((value, index) => {
        const card = document.createElement("article");
        card.className = "note my-note-card personal-note-card";
        const heading = document.createElement("div");
        heading.className = "note-heading";
        heading.textContent = "MI NOTA";
        const content = document.createElement("div");
        content.className = "note-content personal-note-content";
        content.contentEditable = "true";
        content.spellcheck = true;
        content.dataset.placeholder = "Escribe tu nota aquí...";
        content.textContent = value || "";
        content.addEventListener("input", () => {
            const notes = getPersonalNotes();
            while (notes.length < 4) notes.push("");
            notes[index] = content.textContent;
            savePersonalNotes(notes);
        });
        card.append(heading, content);
        grid.appendChild(card);
    });

    empty.hidden = assigned.length > 0 || personal.every(value => !String(value || "").trim());
}


/* =====================================================
   POST-IT
===================================================== */

const storedNotes =
    document.querySelectorAll(
        ".note[data-storage]"
    );


function getTaskRows(content) {
    return content ? [...content.querySelectorAll('.task-row')] : [];
}

function getNoteText(note) {
    const content = note.querySelector('.note-content');
    return getTaskRows(content)
        .map(row => row.querySelector('.task-text')?.value.trim() || '')
        .filter(Boolean)
        .join('\n');
}

function resizeTaskText(text) {
    if (!text) return;
    text.style.height = 'auto';
    text.style.height = Math.max(text.scrollHeight, 28) + 'px';
}

function addTaskRow(content, task = {}) {
    if (!content) return null;
    const row = document.createElement('div');
    row.className = 'task-row' + (task.done ? ' is-done' : '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-check';
    checkbox.setAttribute('aria-label', 'Marcar tarea como completada');
    checkbox.checked = Boolean(task.done);

    const text = document.createElement('textarea');
    text.className = 'task-text';
    text.rows = 1;
    text.wrap = 'soft';
    text.placeholder = content.dataset.placeholder || 'Escribe una tarea...';
    text.value = task.text || '';
    text.autocomplete = 'off';

    row.append(checkbox, text);
    content.appendChild(row);
    resizeTaskText(text);
    return row;
}

function renderTasks(content, tasks = []) {
    content.innerHTML = '';
    const usable = Array.isArray(tasks) ? tasks : [];
    if (usable.length) usable.forEach(task => addTaskRow(content, task));
    else addTaskRow(content);
    content.querySelectorAll('.task-text').forEach(resizeTaskText);
}

function loadSavedNotes() {
    storedNotes.forEach(note => {
        const key = note.dataset.storage;
        if (!key) return;
        try {
            const saved = localStorage.getItem(STORAGE_PREFIX + key);
            if (!saved) { renderTasks(note.querySelector('.note-content')); return; }
            const data = JSON.parse(saved);
            const content = note.querySelector('.note-content');
            const recipient = note.querySelector('.recipient-input');
            if (content) {
                if (Array.isArray(data.tasks)) renderTasks(content, data.tasks);
                else {
                    const legacy = (data.content || '').split('\n').filter(line => line.trim());
                    renderTasks(content, legacy.map(text => ({ text, done: false })));
                }
            }
            if (recipient && data.recipient !== undefined) recipient.value = data.recipient;
        } catch (error) {
            console.warn('No se pudo cargar la nota.', error);
            renderTasks(note.querySelector('.note-content'));
        }
    });
}

function saveNote(note) {
    const key = note.dataset.storage;
    if (!key) return;
    const content = note.querySelector('.note-content');
    const recipient = note.querySelector('.recipient-input');
    const tasks = getTaskRows(content).map(row => ({
        text: row.querySelector('.task-text')?.value || '',
        done: Boolean(row.querySelector('.task-check')?.checked)
    }));
    const data = {
        tasks,
        recipient: recipient ? recipient.value : ''
    };
    const hasText = tasks.some(task => task.text.trim());
    try {
        if (!hasText && !data.recipient.trim()) localStorage.removeItem(STORAGE_PREFIX + key);
        else localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
    } catch (error) {
        console.warn('No se pudo guardar la nota.', error);
    }
}


/* =====================================================
   IDENTIFICAR EL TIPO DE POST-IT
===================================================== */

function getNoteLabel(note) {

    if (note.classList.contains("all-note")) {

        return "NOTAS PARA TODOS";

    }


    if (note.classList.contains("urgent")) {

        const recipient =
            note.querySelector(
                ".recipient-input"
            );


        const name =
            recipient &&
            recipient.value.trim();


        return name
            ? `URGENTE PARA: ${name}`
            : "URGENTE";

    }


    if (note.classList.contains("important")) {

        const recipient =
            note.querySelector(
                ".recipient-input"
            );


        const name =
            recipient &&
            recipient.value.trim();


        return name
            ? `NOTAS PARA: ${name}`
            : "NOTAS IMPORTANTES";

    }


    if (note.classList.contains("temporary")) {

        return "ANOTADOR";

    }


    return "POST-IT";

}


/* =====================================================
   GUARDAR NOTA EN EL CUADERNO
===================================================== */

function archiveNote(note) {

    const content =
        note.querySelector(
            ".note-content"
        );


    const recipient =
        note.querySelector(
            ".recipient-input"
        );


    const text = getNoteText(note).trim();


    const name =
        recipient
            ? recipient.value.trim()
            : "";


    /*
       Si el Post-it está completamente vacío,
       no tiene sentido crear una entrada.
    */

    if (
        text === "" &&
        name === ""
    ) {

        return;

    }


    const notebook =
        getNotebook();


    const now =
        new Date();


    const entry = {

        id:
            Date.now(),

        text:
            text || "(sin texto)",

        label:
            getNoteLabel(note),

        date:
            now.toLocaleDateString(
                "es-ES"
            ),

        time:
            now.toLocaleTimeString(
                "es-ES",
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            )

    };


    /*
       Las nuevas aparecen arriba.
    */

    notebook.unshift(entry);


    saveNotebook(notebook);

}


// Archiva una tarea completada como una entrada independiente del Cuaderno.
function archiveCompletedTask(note, row) {
    const text = row?.querySelector('.task-text')?.value.trim();
    if (!text) {
        row?.remove();
        const content = note.querySelector('.note-content');
        if (content && !getTaskRows(content).length) addTaskRow(content);
        saveNote(note);
        return;
    }

    const notebook = getNotebook();
    const now = new Date();
    notebook.unshift({
        id: Date.now(),
        text,
        label: getNoteLabel(note),
        date: now.toLocaleDateString('es-ES'),
        time: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    });
    saveNotebook(notebook);

    row.remove();
    const content = note.querySelector('.note-content');
    if (content && !getTaskRows(content).length) addTaskRow(content);
    saveNote(note);
    renderNotebook();
}


/* =====================================================
   BORRAR POST-IT
===================================================== */

function clearNote(note) {

    /*
       PRIMERO archivamos la nota.
    */

    archiveNote(note);


    /*
       DESPUÉS vaciamos el Post-it.
    */

    const content =
        note.querySelector(
            ".note-content"
        );


    const recipient =
        note.querySelector(
            ".recipient-input"
        );


    if (content) {
        renderTasks(content);
    }


    if (recipient) {

        recipient.value = "";

    }


    /*
       Las notas persistentes se eliminan
       de localStorage.
    */

    const key =
        note.dataset.storage;


    if (key) {

        try {

            localStorage.removeItem(
                STORAGE_PREFIX + key
            );

        } catch (error) {

            console.warn(
                "No se pudo borrar la nota.",
                error
            );

        }

    }


    /*
       Actualizamos el Cuaderno por si
       el usuario cambia inmediatamente
       a esa pestaña.
    */

    renderNotebook();

}


/* =====================================================
   EVENTOS DE LOS POST-IT
===================================================== */

storedNotes.forEach(note => {
    const content = note.querySelector('.note-content');
    const recipient = note.querySelector('.recipient-input');
    const deleteButton = note.querySelector('.delete-note');

    if (content) {
        content.addEventListener('input', event => {
            if (event.target.classList.contains('task-text')) { resizeTaskText(event.target); saveNote(note); if (document.getElementById('my-notes-view')?.classList.contains('active')) renderMyNotes(); }
        });
        content.addEventListener('change', event => {
            if (event.target.classList.contains('task-check')) {
                const row = event.target.closest('.task-row');
                row?.classList.toggle('is-done', event.target.checked);
                if (event.target.checked) {
                    row.dataset.archiveTimer = window.setTimeout(() => {
                        archiveCompletedTask(note, row);
                    }, 2000);
                } else {
                    window.clearTimeout(Number(row?.dataset.archiveTimer));
                    if (row) delete row.dataset.archiveTimer;
                    saveNote(note);
                }
            }
        });
        content.addEventListener('keydown', event => {
            if (!event.target.classList.contains('task-text')) return;
            if (event.key === 'Enter') {
                event.preventDefault();
                const row = addTaskRow(content);
                row?.querySelector('.task-text')?.focus();
                saveNote(note);
            } else if (event.key === 'Backspace' && event.target.value === '' && getTaskRows(content).length > 1) {
                event.preventDefault();
                const previous = event.target.closest('.task-row').previousElementSibling;
                event.target.closest('.task-row').remove();
                previous?.querySelector('.task-text')?.focus();
                saveNote(note);
            }
        });
    }
    if (recipient) recipient.addEventListener('input', () => { saveNote(note); if (document.getElementById('my-notes-view')?.classList.contains('active')) renderMyNotes(); });
    if (deleteButton) deleteButton.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation(); clearNote(note);
    });
});


/*
   Los anotadores blancos NO tienen
   data-storage porque deben desaparecer
   al cerrar el navegador.

   Pero sí queremos que puedan entrar
   al Cuaderno cuando se pulsa X.
*/

const temporaryNotes =
    document.querySelectorAll(
        ".temporary"
    );


temporaryNotes.forEach(note => {

    const deleteButton =
        note.querySelector(
            ".delete-note"
        );


    if (deleteButton) {

        deleteButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopPropagation();


                archiveNote(note);


                const content =
                    note.querySelector(
                        ".note-content"
                    );


                if (content) {
                    renderTasks(content);
                }


                renderNotebook();

            }
        );

    }

    const content = note.querySelector('.note-content');
    if (content) {
        content.addEventListener('input', event => {
            if (!event.target.classList.contains('task-text')) return;
        });
        content.addEventListener('change', event => {
            if (event.target.classList.contains('task-check')) {
                const row = event.target.closest('.task-row');
                row?.classList.toggle('is-done', event.target.checked);
                if (event.target.checked) {
                    row.dataset.archiveTimer = window.setTimeout(() => {
                        archiveCompletedTask(note, row);
                    }, 2000);
                } else {
                    window.clearTimeout(Number(row?.dataset.archiveTimer));
                    if (row) delete row.dataset.archiveTimer;
                }
            }
        });
        content.addEventListener('keydown', event => {
            if (!event.target.classList.contains('task-text')) return;
            if (event.key === 'Enter') {
                event.preventDefault();
                addTaskRow(content)?.querySelector('.task-text')?.focus();
            } else if (event.key === 'Backspace' && event.target.value === '' && getTaskRows(content).length > 1) {
                event.preventDefault();
                const row = event.target.closest('.task-row');
                const previous = row.previousElementSibling;
                row.remove();
                previous?.querySelector('.task-text')?.focus();
            }
        });
    }


});


loadSavedNotes();
temporaryNotes.forEach(note => renderTasks(note.querySelector('.note-content')));


/* =====================================================
   CUADERNO
===================================================== */

function getNotebook() {

    try {

        const saved =
            localStorage.getItem(
                NOTEBOOK_STORAGE
            );


        if (!saved) {

            return [];

        }


        const notebook =
            JSON.parse(saved);


        return Array.isArray(notebook)
            ? notebook
            : [];

    } catch (error) {

        console.warn(
            "No se pudo leer el Cuaderno.",
            error
        );

        return [];

    }

}


function saveNotebook(notebook) {

    try {

        localStorage.setItem(
            NOTEBOOK_STORAGE,
            JSON.stringify(notebook)
        );

    } catch (error) {

        console.warn(
            "No se pudo guardar el Cuaderno.",
            error
        );

    }

}


/* =====================================================
   MOSTRAR CUADERNO
===================================================== */

function renderNotebook() {

    const container =
        document.getElementById(
            "deleted-notes"
        );


    const empty =
        document.getElementById(
            "empty-notebook"
        );


    if (!container || !empty) {

        return;

    }


    const notebook =
        getNotebook();


    container.innerHTML = "";


    if (notebook.length === 0) {

        empty.style.display =
            "block";

        return;

    }


    empty.style.display =
        "none";


    notebook.forEach(entry => {

        const item =
            document.createElement(
                "div"
            );


        item.className =
            "deleted-note";


        const content =
            document.createElement(
                "div"
            );


        content.className =
            "deleted-note-content";


        /*
           El label NO está tachado.
           El texto de la nota sí.
        */

        const label =
            document.createElement(
                "span"
            );


        label.className =
            "deleted-note-label";


        label.textContent =
            entry.label + " —";


        content.appendChild(label);


        const text =
            document.createTextNode(
                " " + entry.text
            );


        content.appendChild(text);


        const date =
            document.createElement(
                "div"
            );


        date.className =
            "deleted-note-date";


        date.textContent =
            `${entry.date} · ${entry.time}`;


        item.appendChild(content);

        item.appendChild(date);


        container.appendChild(item);

    });

}


/*
   Mostrar el Cuaderno al cargar,
   aunque todavía no se haya abierto.
*/

renderNotebook();


/* =====================================================
   CALENDARIO MENSUAL Y ANOTACIONES POR DÍA
===================================================== */

const CALENDAR_STORAGE = "postit-app-calendar-events";
const CALENDAR_COLORS_STORAGE = "postit-app-calendar-colors";
const calendarDays = document.getElementById("calendar-days");
const calendarMonthLabel = document.getElementById("calendar-month-label");
const calendarSelectedLabel = document.getElementById("calendar-selected-label");
const calendarEventsContainer = document.getElementById("calendar-events");
const calendarEventForm = document.getElementById("calendar-event-form");
const calendarEventInput = document.getElementById("calendar-event-input");

const calendarToday = new Date();
let calendarMonth = new Date(calendarToday.getFullYear(), calendarToday.getMonth(), 1);
let calendarSelectedDate = dateToKey(calendarToday);

function dateToKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function keyToDate(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function getCalendarEvents() {
    try {
        const saved = localStorage.getItem(CALENDAR_STORAGE);
        const parsed = saved ? JSON.parse(saved) : {};
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        console.warn("No se pudieron cargar las anotaciones del calendario.", error);
        return {};
    }
}

function saveCalendarEvents(events) {
    try {
        localStorage.setItem(CALENDAR_STORAGE, JSON.stringify(events));
    } catch (error) {
        console.warn("No se pudieron guardar las anotaciones del calendario.", error);
    }
}

function getCalendarColors() {
    try {
        const saved = JSON.parse(localStorage.getItem(CALENDAR_COLORS_STORAGE) || "{}");
        return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch { return {}; }
}

function saveCalendarColors(colors) {
    try { localStorage.setItem(CALENDAR_COLORS_STORAGE, JSON.stringify(colors)); }
    catch (error) { console.warn("No se pudieron guardar los colores del calendario.", error); }
}

function setSelectedDayColor(color) {
    const colors = getCalendarColors();
    if (color) colors[calendarSelectedDate] = color;
    else delete colors[calendarSelectedDate];
    saveCalendarColors(colors);
    renderCalendar();
}

document.querySelectorAll(".calendar-color-button").forEach(button => {
    button.addEventListener("click", () => {
        const chosen = button.dataset.color;
        setSelectedDayColor(chosen);
    });
});
document.getElementById("calendar-color-clear")?.addEventListener("click", () => setSelectedDayColor(""));

function renderCalendar() {
    if (!calendarDays || !calendarMonthLabel) return;

    const events = getCalendarEvents();
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    calendarMonthLabel.textContent = calendarMonth.toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric"
    });

    calendarDays.innerHTML = "";

    const firstDay = new Date(year, month, 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - mondayOffset);

    for (let i = 0; i < 42; i++) {
        const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
        const key = dateToKey(date);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "calendar-day";
        button.textContent = String(date.getDate());
        button.setAttribute("aria-label", date.toLocaleDateString("es-ES", {
            weekday: "long", day: "numeric", month: "long", year: "numeric"
        }));

        if (date.getMonth() !== month) button.classList.add("is-outside");
        const dayColor = getCalendarColors()[key];
        if (dayColor && ["green", "yellow", "red"].includes(dayColor)) button.classList.add("day-color-" + dayColor);
        if (key === calendarSelectedDate) button.classList.add("is-selected");
        if (key === dateToKey(calendarToday)) button.classList.add("is-today");
        if (Array.isArray(events[key]) && events[key].length) button.classList.add("has-events");

        button.addEventListener("click", () => {
            calendarSelectedDate = key;
            calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            renderCalendar();
        });

        calendarDays.appendChild(button);
    }

    renderSelectedCalendarDay(events);
}

function renderSelectedCalendarDay(events = getCalendarEvents()) {
    if (!calendarSelectedLabel || !calendarEventsContainer) return;

    const selected = keyToDate(calendarSelectedDate);
    const selectedColor = getCalendarColors()[calendarSelectedDate] || "";
    document.querySelectorAll(".calendar-color-button").forEach(button => {
        const active = button.dataset.color === selectedColor;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
    });
    calendarSelectedLabel.textContent = selected.toLocaleDateString("es-ES", {
        weekday: "long", day: "numeric", month: "long"
    });

    calendarEventsContainer.innerHTML = "";
    const entries = Array.isArray(events[calendarSelectedDate]) ? events[calendarSelectedDate] : [];

    if (!entries.length) {
        const empty = document.createElement("p");
        empty.className = "calendar-empty";
        empty.textContent = "No hay nada apuntado.";
        calendarEventsContainer.appendChild(empty);
        return;
    }

    entries.forEach((entry, index) => {
        const row = document.createElement("div");
        row.className = "calendar-event";

        const text = document.createElement("span");
        text.className = "calendar-event-text";
        text.textContent = typeof entry === "string" ? entry : entry.text || "";

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "calendar-event-delete";
        remove.textContent = "×";
        remove.setAttribute("aria-label", "Eliminar anotación");
        remove.addEventListener("click", () => {
            const updated = getCalendarEvents();
            if (!Array.isArray(updated[calendarSelectedDate])) return;
            const selectedEntry = updated[calendarSelectedDate][index];
            if (selectedEntry && selectedEntry.id) {
                Object.keys(updated).forEach(key => {
                    updated[key] = (updated[key] || []).filter(item => item?.id !== selectedEntry.id);
                    if (!updated[key].length) delete updated[key];
                });
            } else {
                updated[calendarSelectedDate].splice(index, 1);
                if (!updated[calendarSelectedDate].length) delete updated[calendarSelectedDate];
            }
            saveCalendarEvents(updated);
            renderCalendar();
        });

        row.append(text, remove);
        calendarEventsContainer.appendChild(row);
    });
}

document.getElementById("calendar-prev")?.addEventListener("click", () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    renderCalendar();
});

document.getElementById("calendar-next")?.addEventListener("click", () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    renderCalendar();
});

const calendarEventEnd = document.getElementById("calendar-event-end");

calendarEventForm?.addEventListener("submit", event => {
    event.preventDefault();
    const text = calendarEventInput?.value.trim();
    if (!text) return;

    const startKey = calendarSelectedDate;
    const endKey = calendarEventEnd?.value || startKey;
    if (endKey < startKey) {
        window.alert("La fecha final no puede ser anterior a la fecha de inicio.");
        return;
    }

    const events = getCalendarEvents();
    const rangeId = `range-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let cursor = keyToDate(startKey);
    const finalDate = keyToDate(endKey);

    while (cursor <= finalDate) {
        const key = dateToKey(cursor);
        if (!Array.isArray(events[key])) events[key] = [];
        events[key].push({ id: rangeId, text, start: startKey, end: endKey });
        cursor.setDate(cursor.getDate() + 1);
    }

    saveCalendarEvents(events);
    calendarEventInput.value = "";
    if (calendarEventEnd) calendarEventEnd.value = "";
    renderCalendar();
    calendarEventInput.focus();
});

renderCalendar();


/* =====================================================
   CALCULADORA
===================================================== */

const display =
    document.getElementById(
        "calc-display"
    );


const calculatorButtons =
    document.querySelectorAll(
        ".calculator-buttons button"
    );


let currentExpression = "";

let justCalculated = false;


function updateDisplay(value) {

    display.value =
        value || "0";

}


function isOperator(char) {

    return [
        "+",
        "-",
        "*",
        "/",
        "%"
    ].includes(char);

}


function addValue(value) {

    if (justCalculated) {

        if (!isOperator(value)) {

            currentExpression = "";

        }

        justCalculated = false;

    }


    if (
        isOperator(value) &&
        currentExpression === ""
    ) {

        if (value !== "-") {

            return;

        }

    }


    const last =
        currentExpression.slice(-1);


    if (
        isOperator(value) &&
        isOperator(last)
    ) {

        currentExpression =
            currentExpression.slice(0, -1);

    }


    currentExpression += value;


    updateDisplay(
        currentExpression
    );

}


function clearCalculator() {

    currentExpression = "";

    justCalculated = false;

    updateDisplay("0");

}


function backspace() {

    if (justCalculated) {

        clearCalculator();

        return;

    }


    currentExpression =
        currentExpression.slice(0, -1);


    updateDisplay(
        currentExpression
    );

}


function calculate() {

    if (!currentExpression) {

        return;

    }


    let expression =
        currentExpression;


    expression =
        expression.replace(
            /(\d+(?:\.\d+)?)%/g,
            "($1/100)"
        );


    if (
        !/^[0-9+\-*/().\s]+$/.test(
            expression
        )
    ) {

        updateDisplay("Error");

        currentExpression = "";

        justCalculated = true;

        return;

    }


    try {

        const result =
            Function(
                '"use strict"; return (' +
                expression +
                ')'
            )();


        if (
            typeof result !== "number" ||
            !Number.isFinite(result)
        ) {

            throw new Error();

        }


        const rounded =
            Math.round(
                (result + Number.EPSILON) *
                100000000
            ) / 100000000;


        currentExpression =
            String(rounded);


        updateDisplay(
            currentExpression
        );


        justCalculated = true;

    } catch (error) {

        updateDisplay("Error");

        currentExpression = "";

        justCalculated = true;

    }

}


/* =====================================================
   BOTONES CALCULADORA
===================================================== */

calculatorButtons.forEach(button => {

    button.addEventListener(
        "click",
        () => {

            const value =
                button.dataset.value;


            const action =
                button.dataset.calc;


            if (action === "clear") {

                clearCalculator();

                return;

            }


            if (action === "backspace") {

                backspace();

                return;

            }


            if (action === "equals") {

                calculate();

                return;

            }


            if (value !== undefined) {

                addValue(value);

            }

        }
    );

});


/* =====================================================
   TECLADO
===================================================== */

document.addEventListener(
    "keydown",
    event => {

        const active =
            document.activeElement;


        /*
           Nunca interferimos mientras
           escribes en un Post-it.
        */

        if (
            active &&
            (
                active.isContentEditable ||
                active.classList.contains(
                    "recipient-input"
                )
            )
        ) {

            return;

        }


        const calculator =
            document.querySelector(
                ".calculator"
            );


        if (
            calculator &&
            (
                calculator.contains(active) ||
                active === display
            )
        ) {


            if (
                /^[0-9+\-*/.%]$/.test(
                    event.key
                )
            ) {

                event.preventDefault();

                addValue(event.key);

                return;

            }


            if (event.key === "Enter") {

                event.preventDefault();

                calculate();

                return;

            }


            if (event.key === "Backspace") {

                event.preventDefault();

                backspace();

                return;

            }


            if (event.key === "Escape") {

                event.preventDefault();

                clearCalculator();

            }

        }

    }
);
