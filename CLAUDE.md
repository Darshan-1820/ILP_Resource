# TCS ILP Ultimate Study Guide

## Project Overview
A comprehensive, multi-page study guide covering ALL TCS ILP exams (FA, PRA, HSE, Sprints, Versant).

## Tech Stack
- Plain HTML/CSS/JS — no build tools, no frameworks
- Opens directly in browser (file:// or any static server)

## Project Structure
```
ILP_Resource/
├── index.html          # Hub page with exam overview + navigation cards
├── css/styles.css      # All styles (sidebar, boxes, practice, responsive)
├── js/app.js           # Interactivity (scroll spy, search, mobile menu, progress)
└── pages/
    ├── html.html       # HTML (FA objective)
    ├── css.html        # CSS (FA objective)
    ├── javascript.html # JavaScript (FA objective)
    ├── unix.html       # Unix/Linux (FA objective + Round 2 minor)
    ├── sql.html        # SQL (FA objective)
    ├── plsql.html      # PL/SQL (FA only)
    ├── java.html       # Java (FA Round 2 major + PRA + HSE) — LARGEST
    ├── jdbc.html       # JDBC (PRA + Sprint 2)
    ├── servlets.html   # Servlets (PRA + Sprint 3)
    ├── springboot.html # Spring Boot CRUD (PRA + Sprint 3)
    ├── rest-json-xml.html # REST/JSON/XML (HSE critical)
    ├── typescript.html # TypeScript (PRA + Sprint 4)
    ├── angular.html    # Angular (PRA + Sprint 4)
    ├── microservices.html # Microservices (PRA)
    ├── hse-coding.html # HackerRank coding patterns + templates
    └── bizskills.html  # BizSkills + Versant V4SE
```

## CSS Classes Reference
- `.box.box-tip` — yellow tip box
- `.box.box-warn` — red warning box
- `.box.box-example` — blue example box
- `.box.box-key` — green key fact box
- `.box.box-exam` — purple exam-specific box
- `.practice` — practice question container
- `.sec-[name]` — section color classes (html, css, js, unix, sql, plsql, java, jdbc, servlets, springboot, typescript, angular, rest, micro, coding, biz)
- Code highlighting: `.kw`, `.str`, `.num`, `.cmt`, `.fn`, `.type`

## How to Run
Just open `index.html` in any browser. No server needed.

## Studio
Global agent framework: C:\Users\addar\Studio\
Profile: C:\Users\addar\Studio\profile\darshan.md
