const INTENT_COLORS = {
      query: { bg: "rgba(34,211,238,0.18)", fg: "#22D3EE", label: "GENERAL QUERY" },
      service_recommendation: { bg: "rgba(0,230,176,0.18)", fg: "#00E6B0", label: "SERVICE RECOMMENDATION" },
      document_help: { bg: "rgba(255,201,74,0.18)", fg: "#FFC94A", label: "DOCUMENT HELP" },
      complaint: { bg: "rgba(255,107,122,0.18)", fg: "#FF6B7A", label: "COMPLAINT" },
    };

    const PRIORITY_COLORS = {
      high: { bg: "rgba(255,107,122,0.18)", fg: "#FF6B7A" },
      medium: { bg: "rgba(255,201,74,0.18)", fg: "#FFC94A" },
      low: { bg: "rgba(0,230,176,0.18)", fg: "#00E6B0" },
    };

    const VOICE_LANG_CODES = {
      Auto: "en-IN", English: "en-IN", Hindi: "hi-IN", Tamil: "ta-IN",
      Bengali: "bn-IN", Marathi: "mr-IN", Telugu: "te-IN",
    };

    function setupVoiceInput() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const micBtn = document.getElementById("mic-btn");
      if (!SpeechRecognition) {
        micBtn.style.display = "none";
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      let isListening = false;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const field = document.getElementById("field-citizen_message");
        field.value = (field.value ? field.value + " " : "") + transcript;
      };
      recognition.onend = () => { isListening = false; micBtn.classList.remove("listening"); };
      recognition.onerror = () => { isListening = false; micBtn.classList.remove("listening"); };

      micBtn.addEventListener("click", () => {
        if (isListening) { recognition.stop(); return; }
        recognition.lang = VOICE_LANG_CODES[document.getElementById("field-response_language").value] || "en-IN";
        recognition.start();
        isListening = true;
        micBtn.classList.add("listening");
      });
    }
    setupVoiceInput();

    function setupReadAloud() {
      const speakBtn = document.getElementById("speak-btn");
      if (!("speechSynthesis" in window)) {
        speakBtn.style.display = "none";
        return;
      }

      speakBtn.addEventListener("click", () => {
        if (speechSynthesis.speaking) {
          speechSynthesis.cancel();
          speakBtn.classList.remove("speaking");
          return;
        }
        const text = document.getElementById("res-explanation").textContent;
        if (!text) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = VOICE_LANG_CODES[document.getElementById("field-response_language").value] || "en-IN";
        utterance.onend = () => speakBtn.classList.remove("speaking");
        utterance.onerror = () => speakBtn.classList.remove("speaking");

        speechSynthesis.speak(utterance);
        speakBtn.classList.add("speaking");
      });
    }
    setupReadAloud();

    document.querySelectorAll(".chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const field = document.getElementById("field-citizen_message");
        field.value = btn.dataset.fill;
        field.focus();
      });
    });

    function setWorkspaceStatus(label, color) {
      const pill = document.getElementById("workspace-pill");
      pill.textContent = label;
      pill.style.color = color || "var(--muted)";
    }

    function setHeaderStatus(processing) {
      const dot = document.getElementById("status-dot");
      const text = document.getElementById("status-text");
      if (processing) {
        dot.classList.add("pulsing");
        dot.style.background = "var(--accent)";
        text.textContent = "MODEL: gemini-3.1-flash-lite · PROCESSING";
      } else {
        dot.classList.remove("pulsing");
        dot.style.background = "var(--mint)";
        text.textContent = "MODEL: gemini-3.1-flash-lite · READY";
      }
    }

    function showError(msg) {
      const box = document.getElementById("error-box");
      box.textContent = msg;
      box.classList.remove("hidden");
    }
    function hideError() {
      document.getElementById("error-box").classList.add("hidden");
    }

    function clearFields() {
      document.getElementById("field-citizen_message").value = "";
      document.getElementById("field-response_language").value = "Auto";
      document.getElementById("results").classList.add("hidden");
      document.getElementById("empty-state").classList.remove("hidden");
      setWorkspaceStatus("IDLE");
      hideError();
    }

    function renderResults(data) {
      document.getElementById("empty-state").classList.add("hidden");
      document.getElementById("results").classList.remove("hidden");

      const intentEl = document.getElementById("res-intent");
      const ic = INTENT_COLORS[data.intent] || { bg: "rgba(127,160,194,0.18)", fg: "#7FA0C2", label: (data.intent || "UNKNOWN").toUpperCase() };
      intentEl.textContent = ic.label;
      intentEl.style.background = ic.bg;
      intentEl.style.color = ic.fg;

      document.getElementById("res-explanation").textContent = data.plain_explanation || "—";

      const servicesWrap = document.getElementById("res-services-wrap");
      const services = data.recommended_services || [];
      if (services.length) {
        servicesWrap.classList.remove("hidden");
        document.getElementById("res-services").innerHTML = services.map((s, i) => `
      <div class="list-item" style="animation-delay:${i * 90}ms; padding-left:0.25rem;">
        <span class="font-semibold" style="color:var(--text);">${s.name}</span>
        <span class="font-mono text-[10px] block mt-0.5" style="color:var(--muted);">${s.department}</span>
        <span class="text-xs block mt-1" style="color:var(--text);">${s.how_to_apply}</span>
      </div>`).join("");
      } else {
        servicesWrap.classList.add("hidden");
      }

      const docsWrap = document.getElementById("res-docs-wrap");
      const docs = data.required_documents || [];
      if (docs.length) {
        docsWrap.classList.remove("hidden");
        document.getElementById("res-docs").innerHTML = docs
          .map((d, i) => `<li class="list-item" style="color:var(--text); animation-delay:${i * 90}ms;">${d}</li>`)
          .join("");
      } else {
        docsWrap.classList.add("hidden");
      }

      const complaintWrap = document.getElementById("res-complaint-wrap");
      if (data.intent === "complaint" && data.complaint_summary) {
        complaintWrap.classList.remove("hidden");
        document.getElementById("res-complaint-summary").textContent = data.complaint_summary;
        const p = PRIORITY_COLORS[data.priority] || { bg: "rgba(127,160,194,0.18)", fg: "#7FA0C2" };
        const priorityEl = document.getElementById("res-priority");
        priorityEl.textContent = (data.priority || "medium").toUpperCase();
        priorityEl.style.background = p.bg;
        priorityEl.style.color = p.fg;
      } else {
        complaintWrap.classList.add("hidden");
      }

      const steps = data.next_steps || [];
      document.getElementById("res-next-steps").innerHTML = steps
        .map((s, i) => `<li class="list-item" style="color:var(--text); animation-delay:${i * 90}ms;">${s}</li>`)
        .join("");

      setWorkspaceStatus("SUCCESS", "var(--mint)");
    }

    function renderComplaints(list) {
      const container = document.getElementById("complaint-list");
      const empty = document.getElementById("complaint-empty");
      document.getElementById("complaint-count").textContent = `${list.length} logged`;

      if (!list.length) {
        empty.classList.remove("hidden");
        container.innerHTML = "";
        container.appendChild(empty);
        return;
      }

      container.innerHTML = list.slice(0, 6).map((c, i) => {
        const p = PRIORITY_COLORS[c.priority] || { bg: "rgba(127,160,194,0.18)", fg: "#7FA0C2" };
        return `
      <div class="glass-inset card-hover rounded-lg p-3 list-item" style="animation-delay:${i * 60}ms;">
        <div class="flex items-center justify-between mb-1">
          <span class="font-mono text-[10px]" style="color:var(--muted);">#${c.id} · ${c.timestamp}</span>
          <span class="font-mono text-[9px] px-2 py-0.5 rounded-full font-semibold" style="background:${p.bg}; color:${p.fg};">${c.priority.toUpperCase()}</span>
        </div>
        <p class="text-xs leading-snug" style="color:var(--text);">${c.summary}</p>
      </div>`;
      }).join("");
    }

    async function loadComplaints() {
      try {
        const res = await fetch("/complaints");
        const payload = await res.json();
        if (payload.ok) renderComplaints(payload.complaints);
      } catch (err) {
        // silent fail — tracker is a bonus panel, not core flow
      }
    }

    async function runEvaluation() {
      hideError();
      const message = document.getElementById("field-citizen_message").value.trim();
      if (!message) {
        showError("Please type a message first.");
        return;
      }

      const btn = document.getElementById("run-btn");
      btn.disabled = true;
      btn.textContent = "Thinking…";
      setHeaderStatus(true);
      setWorkspaceStatus("PROCESSING", "var(--accent)");

      try {
        const res = await fetch("/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            citizen_message: message,
            response_language: document.getElementById("field-response_language").value,
          }),
        });
        const payload = await res.json();

        if (!res.ok || !payload.ok) {
          throw new Error(payload.error || "Request failed.");
        }
        renderResults(payload.data);
        if (payload.data.intent === "complaint") loadComplaints();
      } catch (err) {
        showError(err.message || "Something went wrong.");
        setWorkspaceStatus("ERROR", "var(--error)");
      } finally {
        btn.disabled = false;
        btn.textContent = "Ask Nagrik AI";
        setHeaderStatus(false);
      }
    }

    document.getElementById("run-btn").addEventListener("click", runEvaluation);
    document.getElementById("clear-btn").addEventListener("click", clearFields);

    loadComplaints();