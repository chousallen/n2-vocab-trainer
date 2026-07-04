(function () {
  const vocab = window.N2_VOCAB || [];
  const storeKey = "jongwen-n2-vocab-progress-v1";
  const translationKey = "jongwen-n2-vocab-translations-v1";
  const settingsKey = "jongwen-n2-vocab-settings-v1";

  const state = {
    progress: loadJson(storeKey, {}),
    customTranslations: loadJson(translationKey, {}),
    settings: loadJson(settingsKey, null),
    session: [],
    index: 0,
    flipped: false
  };

  const els = {
    chapterList: document.getElementById("chapterList"),
    allChapters: document.getElementById("allChapters"),
    modeSelect: document.getElementById("modeSelect"),
    studyMode: document.getElementById("studyMode"),
    distractorField: document.getElementById("distractorField"),
    distractorScope: document.getElementById("distractorScope"),
    sampleCount: document.getElementById("sampleCount"),
    sampleField: document.getElementById("sampleField"),
    shuffleCards: document.getElementById("shuffleCards"),
    autoPlay: document.getElementById("autoPlay"),
    startBtn: document.getElementById("startBtn"),
    globalStats: document.getElementById("globalStats"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importFile: document.getElementById("importFile"),
    sessionTitle: document.getElementById("sessionTitle"),
    positionText: document.getElementById("positionText"),
    progressFill: document.getElementById("progressFill"),
    flashcard: document.getElementById("flashcard"),
    cardMeta: document.getElementById("cardMeta"),
    backMeta: document.getElementById("backMeta"),
    wordText: document.getElementById("wordText"),
    frontHint: document.getElementById("frontHint"),
    backWord: document.getElementById("backWord"),
    translationText: document.getElementById("translationText"),
    translationEdit: document.getElementById("translationEdit"),
    dictLink: document.getElementById("dictLink"),
    saveTranslation: document.getElementById("saveTranslation"),
    playAudioBtn: document.getElementById("playAudioBtn"),
    audioPlayer: document.getElementById("audioPlayer"),
    choicePanel: document.getElementById("choicePanel"),
    choiceOptions: document.getElementById("choiceOptions"),
    choiceFeedback: document.getElementById("choiceFeedback"),
    choiceEditHint: document.getElementById("choiceEditHint"),
    choiceTranslationEditor: document.getElementById("choiceTranslationEditor"),
    choiceTranslationEdit: document.getElementById("choiceTranslationEdit"),
    choiceSaveTranslation: document.getElementById("choiceSaveTranslation"),
    prevBtn: document.getElementById("prevBtn"),
    flipBtn: document.getElementById("flipBtn"),
    nextBtn: document.getElementById("nextBtn"),
    missBtn: document.getElementById("missBtn"),
    knownBtn: document.getElementById("knownBtn"),
    wordStats: document.getElementById("wordStats"),
    searchInput: document.getElementById("searchInput"),
    wordList: document.getElementById("wordList")
  };

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_err) { return fallback; }
  }
  function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function getProgress(id) {
    return {
      viewed: 0,
      known: 0,
      missed: 0,
      choiceKnown: 0,
      choiceMissed: 0,
      lastViewed: "",
      lastAnswered: "",
      ...(state.progress[id] || {})
    };
  }
  function setProgress(id, patch) {
    state.progress[id] = { ...getProgress(id), ...patch };
    saveJson(storeKey, state.progress);
    renderGlobalStats();
    renderWordStats();
    renderWordList();
  }
  function translationFor(card) {
    return state.customTranslations[card.id] || card.translation || "尚未建立中文翻譯。可先按下方字典連結查詢，再把翻譯填入並儲存。";
  }
  function translationSourceFor(card) {
    if (state.customTranslations[card.id]) return "custom";
    const labels = {
      quiz: "quiz",
      "jisho+mt": "dictionary + MT",
      "mt-ja": "MT"
    };
    return labels[card.translation_source] || "source unknown";
  }
  function localAudioUrlFor(card) {
    return `../新日檢完勝單語N2/新日檢完勝單語N2_Chapter ${card.chapter}/${card.id}.mp3`;
  }
  function remoteAudioUrlFor(card) {
    return card.audioUrl.replace(/^http:/, "https:");
  }
  function setAudioSource(card) {
    els.audioPlayer.dataset.cardId = card.id;
    els.audioPlayer.dataset.fallbackSrc = "";
    els.audioPlayer.src = remoteAudioUrlFor(card);
    els.playAudioBtn.disabled = false;
  }
  function playAudio() {
    const card = currentCard();
    if (!card) return;
    if (!els.audioPlayer.src) setAudioSource(card);
    els.audioPlayer.currentTime = 0;
    els.audioPlayer.play().catch(() => {});
  }
  function toggleAudio() {
    const card = currentCard();
    if (!card) return;
    if (!els.audioPlayer.src) setAudioSource(card);
    if (els.audioPlayer.paused) {
      els.audioPlayer.play().catch(() => {});
    } else {
      els.audioPlayer.pause();
    }
  }
  function renderRuby(container, card) {
    container.replaceChildren();
    const segments = Array.isArray(card.ruby) && card.ruby.length
      ? card.ruby
      : [{ text: card.word, reading: card.reading || "" }];
    segments.forEach((segment) => {
      if (segment.reading) {
        const ruby = document.createElement("ruby");
        ruby.textContent = segment.text;
        const rt = document.createElement("rt");
        rt.textContent = segment.reading;
        ruby.appendChild(rt);
        container.appendChild(ruby);
      } else {
        container.appendChild(document.createTextNode(segment.text));
      }
    });
  }
  function selectedChapters() {
    return [...els.chapterList.querySelectorAll("input:checked")].map((input) => Number(input.value));
  }
  function saveSettings() {
    const settings = {
      chapters: selectedChapters(),
      mode: els.modeSelect.value,
      studyMode: els.studyMode.value,
      distractorScope: els.distractorScope.value,
      sampleCount: Number(els.sampleCount.value),
      shuffle: els.shuffleCards.checked,
      autoPlay: els.autoPlay.checked
    };
    state.settings = settings;
    saveJson(settingsKey, settings);
  }
  function byWeakness(a, b) {
    const pa = getProgress(a.id), pb = getProgress(b.id);
    const choiceMode = els.studyMode.value === "choice";
    const knownA = choiceMode ? pa.choiceKnown : pa.known;
    const missedA = choiceMode ? pa.choiceMissed : pa.missed;
    const knownB = choiceMode ? pb.choiceKnown : pb.known;
    const missedB = choiceMode ? pb.choiceMissed : pb.missed;
    const scoreA = knownA * 2 - missedA - (pa.viewed ? 0 : 5);
    const scoreB = knownB * 2 - missedB - (pb.viewed ? 0 : 5);
    return scoreA - scoreB || a.id.localeCompare(b.id);
  }
  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function makeSession() {
    saveSettings();
    const chapters = selectedChapters();
    let pool = vocab.filter((card) => chapters.includes(Number(card.chapter)));
    const count = Math.max(1, Math.min(Number(els.sampleCount.value) || 50, pool.length));
    if (els.modeSelect.value === "random") pool = shuffle(pool).slice(0, count);
    if (els.modeSelect.value === "weak") pool = pool.sort(byWeakness).slice(0, count);
    if (els.shuffleCards.checked) pool = shuffle(pool);
    state.session = pool;
    state.index = 0;
    state.flipped = false;
    state.choiceCardId = "";
    state.choiceOptions = [];
    state.choiceAnswered = false;
    state.choiceSelected = "";
    renderCard(true);
    renderWordList();
  }
  function currentCard() { return state.session[state.index]; }
  function markViewed(card) {
    if (!card) return;
    const p = getProgress(card.id);
    setProgress(card.id, { viewed: p.viewed + 1, lastViewed: new Date().toISOString() });
  }
  function renderCard(countView) {
    const card = currentCard();
    const choiceMode = els.studyMode.value === "choice";
    els.flashcard.classList.toggle("flipped", state.flipped);
    els.flipBtn.textContent = state.flipped ? "Show Front" : "Show Back";
    els.choicePanel.hidden = !choiceMode;
    els.flipBtn.hidden = choiceMode;
    els.missBtn.parentElement.hidden = choiceMode;
    if (!card) {
      els.sessionTitle.textContent = "Choose chapters and start";
      els.positionText.textContent = "0 / 0";
      els.progressFill.style.width = "0%";
      els.cardMeta.textContent = "No session";
      els.wordText.textContent = "Start a session";
      els.backWord.replaceChildren();
      els.translationText.textContent = "";
      els.audioPlayer.removeAttribute("src");
      els.audioPlayer.removeAttribute("data-card-id");
      els.audioPlayer.removeAttribute("data-fallback-src");
      els.playAudioBtn.disabled = true;
      els.choiceOptions.replaceChildren();
      els.choiceFeedback.textContent = "";
      els.choiceTranslationEditor.hidden = true;
      els.choiceTranslationEdit.value = "";
      renderWordStats();
      return;
    }
    if (countView) markViewed(card);
    els.sessionTitle.textContent = `${state.session.length} words selected`;
    els.positionText.textContent = `${state.index + 1} / ${state.session.length}`;
    els.progressFill.style.width = `${Math.round(((state.index + 1) / state.session.length) * 100)}%`;
    els.cardMeta.textContent = `Chapter ${card.chapter} / Section ${card.section} / #${card.id}`;
    els.backMeta.textContent = `${els.cardMeta.textContent} / ${translationSourceFor(card)}`;
    els.wordText.textContent = card.word;
    els.frontHint.textContent = choiceMode ? "Choose the correct Chinese meaning below." : "Click the card or press Space to show the back.";
    renderRuby(els.backWord, card);
    els.translationText.textContent = translationFor(card);
    els.translationEdit.value = state.customTranslations[card.id] || card.translation || "";
    els.dictLink.href = `https://mazii.net/en-US/search/word/jatw/${encodeURIComponent(card.word)}`;
    els.dictLink.textContent = "Mazii dictionary";
    const isNewAudioCard = els.audioPlayer.dataset.cardId !== card.id;
    if (isNewAudioCard) setAudioSource(card);
    if (isNewAudioCard && countView && els.autoPlay.checked) {
      els.audioPlayer.play().catch(() => {});
    }
    if (choiceMode) renderChoices(card);
    renderWordStats();
    renderWordList();
  }
  function flipCard() {
    if (!currentCard() || els.studyMode.value === "choice") return;
    state.flipped = !state.flipped;
    renderCard(false);
  }
  function move(delta) {
    if (!state.session.length) return;
    state.index = Math.max(0, Math.min(state.session.length - 1, state.index + delta));
    state.flipped = false;
    renderCard(true);
  }
  function markAnswer(kind) {
    const card = currentCard();
    if (!card) return;
    const p = getProgress(card.id);
    const patch = { lastAnswered: new Date().toISOString() };
    if (kind === "known") patch.known = p.known + 1;
    if (kind === "missed") patch.missed = p.missed + 1;
    setProgress(card.id, patch);
    move(1);
  }
  function choicePool(card) {
    const selected = new Set(selectedChapters());
    let pool = els.distractorScope.value === "selected"
      ? vocab.filter((item) => selected.has(Number(item.chapter)))
      : vocab;
    pool = pool.filter((item) => item.id !== card.id && translationFor(item) !== translationFor(card));
    if (pool.length < 3) {
      pool = vocab.filter((item) => item.id !== card.id && translationFor(item) !== translationFor(card));
    }
    return pool;
  }
  function buildChoiceOptions(card) {
    const used = new Set([translationFor(card)]);
    const distractors = [];
    for (const item of shuffle(choicePool(card))) {
      const text = translationFor(item);
      if (used.has(text)) continue;
      used.add(text);
      distractors.push(item);
      if (distractors.length === 3) break;
    }
    return shuffle([
      { id: card.id, text: translationFor(card), correct: true },
      ...distractors.map((item) => ({ id: item.id, text: translationFor(item), correct: false }))
    ]);
  }
  function renderChoices(card) {
    if (state.choiceCardId !== card.id || !state.choiceOptions.length) {
      state.choiceCardId = card.id;
      state.choiceOptions = buildChoiceOptions(card);
      state.choiceAnswered = false;
      state.choiceSelected = "";
    }
    els.choiceOptions.replaceChildren();
    state.choiceOptions.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-option";
      if (state.choiceAnswered && option.correct) button.classList.add("correct");
      if (state.choiceAnswered && state.choiceSelected === option.id && !option.correct) button.classList.add("wrong");
      button.disabled = state.choiceAnswered;
      button.textContent = `${index + 1}. ${option.text}`;
      button.addEventListener("click", () => selectChoice(option));
      els.choiceOptions.append(button);
    });
    if (!state.choiceAnswered) {
      els.choiceFeedback.textContent = "Choose the correct Chinese meaning.";
    }
    renderChoiceTranslationEditor(card);
  }
  function renderChoiceTranslationEditor(card) {
    els.choiceTranslationEditor.hidden = false;
    els.choiceTranslationEditor.classList.toggle("locked", !state.choiceAnswered);
    els.choiceEditHint.textContent = state.choiceAnswered
      ? "Edit this word's Chinese meaning, then save. It will be used in flashcards and future 4-choice tests."
      : "Answer first to edit this word's Chinese meaning.";
    els.choiceTranslationEdit.disabled = !state.choiceAnswered;
    els.choiceSaveTranslation.disabled = !state.choiceAnswered;
    els.choiceTranslationEdit.value = state.choiceAnswered
      ? state.customTranslations[card.id] || card.translation || ""
      : "";
  }
  function selectChoice(option) {
    const card = currentCard();
    if (!card || state.choiceAnswered) return;
    state.choiceAnswered = true;
    state.choiceSelected = option.id;
    const p = getProgress(card.id);
    const patch = { lastAnswered: new Date().toISOString() };
    if (option.correct) {
      patch.choiceKnown = p.choiceKnown + 1;
      els.choiceFeedback.textContent = "Correct. Press Next or → to continue.";
    } else {
      patch.choiceMissed = p.choiceMissed + 1;
      els.choiceFeedback.textContent = `Missed. Correct meaning: ${translationFor(card)}`;
    }
    setProgress(card.id, patch);
    renderChoices(card);
    setTimeout(() => els.choiceTranslationEditor.scrollIntoView({ block: "nearest", behavior: "smooth" }), 0);
  }
  function saveTranslationFor(card, value) {
    if (value) state.customTranslations[card.id] = value;
    else delete state.customTranslations[card.id];
    saveJson(translationKey, state.customTranslations);
    state.choiceOptions.forEach((option) => {
      if (option.id === card.id) option.text = translationFor(card);
    });
    renderCard(false);
    renderGlobalStats();
    renderWordList();
  }
  function renderChapters() {
    const chapters = [...new Set(vocab.map((card) => Number(card.chapter)))].sort((a, b) => a - b);
    const saved = state.settings?.chapters?.length ? state.settings.chapters : chapters;
    els.chapterList.innerHTML = "";
    chapters.forEach((chapter) => {
      const count = vocab.filter((card) => Number(card.chapter) === chapter).length;
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = String(chapter);
      input.checked = saved.includes(chapter);
      input.addEventListener("change", saveSettings);
      const span = document.createElement("span");
      span.textContent = `${chapter} (${count})`;
      label.append(input, span);
      els.chapterList.append(label);
    });
  }
  function renderGlobalStats() {
    const ids = new Set(vocab.map((card) => card.id));
    const viewed = [...ids].filter((id) => getProgress(id).viewed > 0).length;
    const flashKnown = [...ids].filter((id) => getProgress(id).known > 0).length;
    const choiceKnown = [...ids].filter((id) => getProgress(id).choiceKnown > 0).length;
    const totalViews = [...ids].reduce((sum, id) => sum + getProgress(id).viewed, 0);
    const translations = vocab.filter((card) => card.translation || state.customTranslations[card.id]).length;
    els.globalStats.innerHTML = `
      <div>${viewed} / ${vocab.length} words viewed</div>
      <div>${flashKnown} words known in flashcards</div>
      <div>${choiceKnown} words correct in 4-choice</div>
      <div>${totalViews} total card views</div>
      <div>${translations} words have Chinese translations</div>
    `;
  }
  function renderWordStats() {
    const card = currentCard();
    if (!card) { els.wordStats.innerHTML = ""; return; }
    const p = getProgress(card.id);
    const flashRate = p.known + p.missed ? Math.round((p.known / (p.known + p.missed)) * 100) + "%" : "-";
    const choiceRate = p.choiceKnown + p.choiceMissed ? Math.round((p.choiceKnown / (p.choiceKnown + p.choiceMissed)) * 100) + "%" : "-";
    els.wordStats.innerHTML = `
      <dt>Word ID</dt><dd>${card.id}</dd>
      <dt>Chapter</dt><dd>${card.chapter}</dd>
      <dt>Viewed</dt><dd>${p.viewed}</dd>
      <dt>Flash Known</dt><dd>${p.known}</dd>
      <dt>Flash Missed</dt><dd>${p.missed}</dd>
      <dt>Flash Rate</dt><dd>${flashRate}</dd>
      <dt>Choice Correct</dt><dd>${p.choiceKnown}</dd>
      <dt>Choice Missed</dt><dd>${p.choiceMissed}</dd>
      <dt>Choice Rate</dt><dd>${choiceRate}</dd>
    `;
  }
  function renderWordList() {
    const q = els.searchInput.value.trim().toLowerCase();
    const cards = (state.session.length ? state.session : vocab).filter((card) => {
      return !q || [card.word, card.id, String(card.chapter), translationFor(card)].join(" ").toLowerCase().includes(q);
    }).slice(0, 350);
    const current = currentCard();
    els.wordList.innerHTML = "";
    cards.forEach((card) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "word-item" + (current && current.id === card.id ? " active" : "");
      const p = getProgress(card.id);
      button.innerHTML = `<span>${card.word}<small>Ch ${card.chapter} #${card.id}</small></span><small>F ${p.known}/${p.missed}<br>C ${p.choiceKnown}/${p.choiceMissed}</small>`;
      button.addEventListener("click", () => {
        const idx = state.session.findIndex((item) => item.id === card.id);
        if (idx >= 0) {
          state.index = idx;
        } else {
          state.session = [card];
          state.index = 0;
        }
        state.flipped = false;
        renderCard(true);
      });
      els.wordList.append(button);
    });
  }
  function exportProgress() {
    const blob = new Blob([JSON.stringify({ progress: state.progress, translations: state.customTranslations }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "n2-vocab-progress.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  function importProgress(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const data = JSON.parse(reader.result);
      state.progress = data.progress || {};
      state.customTranslations = data.translations || {};
      saveJson(storeKey, state.progress);
      saveJson(translationKey, state.customTranslations);
      renderCard(false);
      renderGlobalStats();
      renderWordList();
    };
    reader.readAsText(file);
  }

  els.allChapters.addEventListener("click", () => {
    const inputs = [...els.chapterList.querySelectorAll("input")];
    const allChecked = inputs.every((input) => input.checked);
    inputs.forEach((input) => { input.checked = !allChecked; });
    saveSettings();
  });
  els.modeSelect.addEventListener("change", () => {
    els.sampleField.hidden = els.modeSelect.value === "all";
    saveSettings();
  });
  els.studyMode.addEventListener("change", () => {
    els.distractorField.hidden = els.studyMode.value !== "choice";
    state.choiceCardId = "";
    saveSettings();
    renderCard(false);
  });
  [els.sampleCount, els.shuffleCards, els.autoPlay].forEach((el) => el.addEventListener("change", saveSettings));
  els.distractorScope.addEventListener("change", () => {
    state.choiceCardId = "";
    saveSettings();
    renderCard(false);
  });
  els.startBtn.addEventListener("click", makeSession);
  els.flashcard.addEventListener("click", (event) => {
    if (["TEXTAREA", "BUTTON", "A"].includes(event.target.tagName)) return;
    flipCard();
  });
  function isTypingTarget(target) {
    return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
  }
  function handleShortcuts(event) {
    if (isTypingTarget(event.target)) return;
    if (event.code === "Space") { event.preventDefault(); flipCard(); }
    if (event.code === "ArrowRight") move(1);
    if (event.code === "ArrowLeft") move(-1);
    if (els.studyMode.value === "choice" && /^[1-4]$/.test(event.key)) {
      event.preventDefault();
      const option = state.choiceOptions[Number(event.key) - 1];
      if (option) selectChoice(option);
    }
    if (els.studyMode.value !== "choice" && event.key.toLowerCase() === "j") { event.preventDefault(); markAnswer("known"); }
    if (els.studyMode.value !== "choice" && event.key.toLowerCase() === "f") { event.preventDefault(); markAnswer("missed"); }
    if (event.key.toLowerCase() === "p") { event.preventDefault(); toggleAudio(); }
  }
  document.addEventListener("keydown", handleShortcuts);
  els.flipBtn.addEventListener("click", flipCard);
  els.prevBtn.addEventListener("click", () => move(-1));
  els.nextBtn.addEventListener("click", () => move(1));
  els.knownBtn.addEventListener("click", () => markAnswer("known"));
  els.missBtn.addEventListener("click", () => markAnswer("missed"));
  els.playAudioBtn.addEventListener("click", playAudio);
  els.audioPlayer.addEventListener("error", () => {
    const fallback = els.audioPlayer.dataset.fallbackSrc;
    if (fallback && els.audioPlayer.src !== fallback) {
      els.audioPlayer.src = fallback;
      els.audioPlayer.dataset.fallbackSrc = "";
      els.audioPlayer.play().catch(() => {});
    }
  });
  els.saveTranslation.addEventListener("click", () => {
    const card = currentCard();
    if (!card) return;
    saveTranslationFor(card, els.translationEdit.value.trim());
  });
  els.choiceSaveTranslation.addEventListener("click", () => {
    const card = currentCard();
    if (!card || !state.choiceAnswered) return;
    saveTranslationFor(card, els.choiceTranslationEdit.value.trim());
  });
  els.searchInput.addEventListener("input", renderWordList);
  els.exportBtn.addEventListener("click", exportProgress);
  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", () => {
    if (els.importFile.files[0]) importProgress(els.importFile.files[0]);
  });

  if (state.settings) {
    els.modeSelect.value = state.settings.mode || "all";
    els.studyMode.value = state.settings.studyMode || "flashcard";
    els.distractorScope.value = state.settings.distractorScope || "selected";
    els.sampleCount.value = state.settings.sampleCount || 50;
    els.shuffleCards.checked = state.settings.shuffle !== false;
    els.autoPlay.checked = Boolean(state.settings.autoPlay);
  }
  renderChapters();
  els.sampleField.hidden = els.modeSelect.value === "all";
  els.distractorField.hidden = els.studyMode.value !== "choice";
  renderGlobalStats();
  renderWordList();
})();
