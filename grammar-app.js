const state = {
  pool: [],
  current: null,
  answered: false,
  choiceIndex: -1,
  correctIndex: -1,
  options: [],
  stats: JSON.parse(localStorage.getItem("n2GrammarStats") || "{}"),
};

const els = {
  weekFilter: document.getElementById("weekFilter"),
  modeFilter: document.getElementById("modeFilter"),
  shuffleBtn: document.getElementById("shuffleBtn"),
  resetBtn: document.getElementById("resetBtn"),
  cardMeta: document.getElementById("cardMeta"),
  pattern: document.getElementById("pattern"),
  options: document.getElementById("options"),
  feedback: document.getElementById("feedback"),
  nextBtn: document.getElementById("nextBtn"),
  revealBtn: document.getElementById("revealBtn"),
  progress: document.getElementById("progress"),
  stats: document.getElementById("stats"),
  list: document.getElementById("grammarList"),
};

function saveStats() {
  localStorage.setItem("n2GrammarStats", JSON.stringify(state.stats));
}

function statFor(id) {
  if (!state.stats[id]) state.stats[id] = { seen: 0, correct: 0, missed: 0 };
  return state.stats[id];
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function filteredGrammar() {
  const week = els.weekFilter.value;
  let items = week === "all" ? [...N2_GRAMMAR] : N2_GRAMMAR.filter((item) => String(item.week) === week);
  if (els.modeFilter.value === "weak") {
    items.sort((a, b) => {
      const sa = statFor(a.id);
      const sb = statFor(b.id);
      const ra = sa.correct / Math.max(1, sa.seen);
      const rb = sb.correct / Math.max(1, sb.seen);
      return ra - rb || sa.seen - sb.seen;
    });
  }
  return items;
}

function buildOptions(item) {
  const distractors = shuffle(N2_GRAMMAR.filter((candidate) => candidate.id !== item.id));
  const options = shuffle([item, ...distractors.slice(0, 3)]).map((candidate) => ({
    id: candidate.id,
    text: candidate.meaning,
  }));
  return options;
}

function renderQuestion() {
  if (!state.pool.length) {
    els.pattern.textContent = "No grammar selected";
    els.options.innerHTML = "";
    return;
  }

  state.current = state.pool.shift();
  state.answered = false;
  state.options = buildOptions(state.current);
  state.correctIndex = state.options.findIndex((option) => option.id === state.current.id);
  state.choiceIndex = -1;

  const s = statFor(state.current.id);
  s.seen += 1;
  saveStats();

  els.cardMeta.textContent = `Week ${state.current.week} / Day ${state.current.day} / ${state.current.group}`;
  els.pattern.textContent = state.current.pattern;
  els.feedback.textContent = "Choose the closest Chinese meaning. Press 1-4 to answer.";
  els.feedback.className = "feedback";
  els.options.innerHTML = state.options.map((option, index) => `
    <button class="option" type="button" data-index="${index}">
      <span>${index + 1}</span>
      <strong>${option.text}</strong>
    </button>
  `).join("");
  els.options.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => answer(Number(button.dataset.index)));
  });
  renderStats();
}

function answer(index) {
  if (state.answered || !state.current) return;
  state.answered = true;
  state.choiceIndex = index;
  const correct = index === state.correctIndex;
  const s = statFor(state.current.id);
  if (correct) s.correct += 1;
  else s.missed += 1;
  saveStats();

  els.options.querySelectorAll("button").forEach((button, i) => {
    button.disabled = true;
    if (i === state.correctIndex) button.classList.add("correct");
    if (i === index && !correct) button.classList.add("wrong");
  });
  els.feedback.textContent = correct
    ? "Correct. Press Enter for the next question."
    : `Missed. Correct: ${state.current.meaning}`;
  els.feedback.className = `feedback ${correct ? "ok" : "bad"}`;
  renderStats();
}

function reveal() {
  if (!state.current || state.answered) return;
  answer(state.correctIndex);
}

function startSession() {
  const items = filteredGrammar();
  state.pool = els.modeFilter.value === "ordered" ? items : shuffle(items);
  renderQuestion();
}

function renderStats() {
  const totalSeen = Object.values(state.stats).reduce((sum, s) => sum + s.seen, 0);
  const totalCorrect = Object.values(state.stats).reduce((sum, s) => sum + s.correct, 0);
  const totalMissed = Object.values(state.stats).reduce((sum, s) => sum + s.missed, 0);
  const rate = totalSeen ? Math.round((totalCorrect / Math.max(1, totalCorrect + totalMissed)) * 100) : 0;
  els.stats.innerHTML = `
    <div><b>${N2_GRAMMAR.length}</b><span>patterns</span></div>
    <div><b>${totalSeen}</b><span>seen</span></div>
    <div><b>${totalCorrect}</b><span>correct</span></div>
    <div><b>${rate}%</b><span>answer rate</span></div>
  `;
  const remaining = state.pool.length;
  els.progress.textContent = state.current ? `${remaining} left in this session` : "Start a session";
}

function renderList() {
  els.list.innerHTML = N2_GRAMMAR.map((item) => {
    const s = statFor(item.id);
    const attempts = s.correct + s.missed;
    const rate = attempts ? Math.round((s.correct / attempts) * 100) : "-";
    return `
      <article>
        <div>
          <span>W${item.week}D${item.day} ${item.group}</span>
          <strong>${item.pattern}</strong>
          <p>${item.meaning}</p>
        </div>
        <small>${s.correct}/${attempts} ${rate}%</small>
      </article>
    `;
  }).join("");
}

els.weekFilter.innerHTML = `<option value="all">All weeks</option>` +
  [...new Set(N2_GRAMMAR.map((item) => item.week))]
    .map((week) => `<option value="${week}">Week ${week}</option>`)
    .join("");

els.shuffleBtn.addEventListener("click", startSession);
els.nextBtn.addEventListener("click", renderQuestion);
els.revealBtn.addEventListener("click", reveal);
els.resetBtn.addEventListener("click", () => {
  if (!confirm("Reset local grammar progress?")) return;
  state.stats = {};
  saveStats();
  renderStats();
  renderList();
});
document.addEventListener("keydown", (event) => {
  if (/^[1-4]$/.test(event.key)) answer(Number(event.key) - 1);
  if (event.key === "Enter") renderQuestion();
  if (event.key.toLowerCase() === "r") reveal();
});

renderStats();
renderList();
startSession();
