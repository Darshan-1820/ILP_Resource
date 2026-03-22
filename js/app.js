/* ========================================
   TCS ILP Ultimate Study Guide — JS
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {

  const sidebar = document.querySelector('.sidebar');
  const toggle = document.querySelector('.menu-toggle');

  // ── Create overlay for mobile sidebar ──
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // prevent background scroll
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ── Mobile menu toggle ──
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      if (sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    // Close sidebar when overlay is tapped
    overlay.addEventListener('click', closeSidebar);

    // Close sidebar when a link is clicked on mobile
    sidebar.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        if (window.innerWidth <= 900) closeSidebar();
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
    });
  }

  // ── Sidebar active link tracking ──
  document.querySelectorAll('.sidebar a').forEach(a => {
    a.addEventListener('click', () => {
      document.querySelectorAll('.sidebar a').forEach(l => l.classList.remove('active'));
      a.classList.add('active');
    });
  });

  // ── Interactive MCQ practice questions ──
  document.querySelectorAll('.practice').forEach(practice => {
    const options = practice.querySelectorAll('.options li');
    const btn = practice.querySelector('.answer-btn');
    const answer = practice.querySelector('.answer');
    if (!btn || !answer) return;

    const correctIndex = parseInt(answer.getAttribute('data-correct') || '0');

    // Make options clickable
    options.forEach((li, i) => {
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        if (practice.classList.contains('answered')) return; // already answered
        // Clear previous selection
        options.forEach(o => o.classList.remove('selected'));
        li.classList.add('selected');
        practice.setAttribute('data-selected', i);
        btn.textContent = 'Check Answer';
      });
    });

    btn.addEventListener('click', () => {
      // If already showing answer, toggle hide
      if (practice.classList.contains('answered')) {
        answer.classList.toggle('show');
        btn.textContent = answer.classList.contains('show') ? 'Hide Answer' : 'Show Answer';
        return;
      }

      const selectedIndex = practice.getAttribute('data-selected');

      // If no option selected (questions without options, like subjective), just show answer
      if (selectedIndex === null || options.length === 0) {
        answer.classList.toggle('show');
        btn.textContent = answer.classList.contains('show') ? 'Hide Answer' : 'Show Answer';
        return;
      }

      // Mark as answered
      practice.classList.add('answered');
      const selected = parseInt(selectedIndex);

      // Highlight correct and wrong
      options.forEach((li, i) => {
        if (i === correctIndex) li.classList.add('correct');
        if (i === selected && i !== correctIndex) li.classList.add('wrong');
      });

      // Show answer explanation
      answer.classList.add('show');
      btn.textContent = 'Hide Answer';
    });
  });

  // ── IDE Explain toggle ──
  document.querySelectorAll('.ide-explain-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ide = btn.closest('.ide');
      const explanation = ide.querySelector('.ide-explanation');
      if (explanation) {
        const wasHidden = !explanation.classList.contains('show');
        explanation.classList.toggle('show');
        btn.classList.toggle('active');
        btn.textContent = explanation.classList.contains('show') ? 'Hide explanation' : 'Explain this ↓';

        // Auto-scroll explanation into view when opened
        if (wasHidden) {
          setTimeout(() => {
            explanation.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        }
      }
    });
  });

  // ── Back to top button ──
  const backBtn = document.querySelector('.back-to-top');
  if (backBtn) {
    let scrollTicking = false;
    window.addEventListener('scroll', () => {
      if (!scrollTicking) {
        requestAnimationFrame(() => {
          backBtn.classList.toggle('visible', window.scrollY > 300);
          scrollTicking = false;
        });
        scrollTicking = true;
      }
    }, { passive: true });
    backBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Sidebar search/filter ──
  const searchInput = document.querySelector('.search-box input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      document.querySelectorAll('.sidebar a').forEach(a => {
        const text = a.textContent.toLowerCase();
        a.style.display = text.includes(query) || query === '' ? 'block' : 'none';
      });
      // Also show/hide section labels and dividers
      document.querySelectorAll('.sidebar .section-label, .sidebar .divider').forEach(el => {
        el.style.display = query === '' ? '' : 'none';
      });
    });
  }

  // ── Scroll spy — highlight current section in sidebar ──
  const sections = document.querySelectorAll('section[id]');
  if (sections.length > 0) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          document.querySelectorAll('.sidebar a').forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    sections.forEach(s => observer.observe(s));
  }

  // ── Progress bar (tracks scroll %) ──
  const progressFill = document.querySelector('.progress-bar .fill');
  if (progressFill) {
    let progressTicking = false;
    window.addEventListener('scroll', () => {
      if (!progressTicking) {
        requestAnimationFrame(() => {
          const scrollTop = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
          progressFill.style.width = pct + '%';
          progressTicking = false;
        });
        progressTicking = true;
      }
    }, { passive: true });
  }

  // ── Handle window resize — close sidebar if going to desktop ──
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeSidebar();
  });

  // ── Theme toggle (dark/light) ──
  const themeBtn = document.createElement('button');
  themeBtn.className = 'theme-toggle';
  themeBtn.title = 'Toggle light/dark theme';
  const savedTheme = localStorage.getItem('ilp-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeBtn.textContent = savedTheme === 'light' ? '🌙' : '☀️';
  document.body.appendChild(themeBtn);

  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ilp-theme', next);
    themeBtn.textContent = next === 'light' ? '🌙' : '☀️';
  });

});
