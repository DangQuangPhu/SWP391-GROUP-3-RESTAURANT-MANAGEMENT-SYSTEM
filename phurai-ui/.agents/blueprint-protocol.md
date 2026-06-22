/blueprint 🗺️ **[EPIC DESIGN & SCOPING] <Tên_Tính_Năng_Lớn>** 🗺️

**Context & Goal:**
We are going to build a new major feature: <Mô_tả_yêu_cầu_ngắn_gọn_của_bạn_vào_đây>.
Before we jump into the standard ECC 4-Step execution loop (/plan -> /feature-dev -> /security-reviewer -> /prune), we must align on the Architecture, Tasks, and File Scope.

**Agentic Directives:**
Do NOT generate any implementation code or tests yet. Your ONLY job right now is to analyze the repository and output a structured Blueprint document.

**Output Requirements:**
Please generate an **Architecture Blueprint** containing:
1. **Business Logic Flow:** A clear, step-by-step logic explanation of how this feature will work functionally within the current architecture.
2. **Sequential Task Breakdown:** Split the feature into manageable, independent Tasks (e.g., Task 1: DB Schema & Backend Algo, Task 2: API Routes, Task 3: Frontend UI).
3. **File Scope Radar (CRITICAL):** Explicitly list the EXACT target files for EACH Task. 
   - Files to Modify: (list exact paths)
   - Files to Create: (list exact paths)
   *Rule: You will be strictly restricted to touching ONLY these files in later phases to prevent hallucination.*
4. **Knowledge Writeback:** Propose to document this roadmap in `PROGRESS.md` under an `[EPIC]` tag with `[ ]` checkboxes for tracking.

**Stop Rule:** 
Output the blueprint and wait for my architectural approval. Once I approve, I will command you to execute "Task 1" using our standard `/plan` command.