IBKR-PREFLIGHT-REVIEW-20260910 — Exact review packet prepared for Claude in the existing IBKR Bot conversation. Pending Sayuj approval; not yet sent.

Scope: independently review Astra's passive source-evidence collector only. This is not the full Equities remediation or a review of its production runtime. Read the actual patch below and return PASS, CHANGES REQUESTED or BLOCKED with specific findings. State which tests you ran yourself versus evidence supplied by Astra. Do not launch broker/order calls, consume strategy attempts, modify accounts/credentials, push/merge, or launch further workers.

Repository: SoojOS. Worktree: /Users/sayuj/soojos/.worktrees/task-20260910-equities-passive-preflight
Base: 8169dd4ac629e3b33deb8e2159d5736063a0afd3
Reviewed commit: 4bd3bd5aecf4abb6af11f1d71e8a9d8f35fd86da

Current context: the collector is isolated and is not merged into Equities. It intentionally leaves runtime execution, broker and service status unknown. The original Equities repository remains at 34ae039f3357771c8ec247da3a431cea265ab864. Existing operator and governance controls remain.

Fresh Astra verification on 2026-09-10T11:05:32.396764+00:00: python3 projects/trading-bot/prototype/test_preflight.py -v. Synthetic local fixtures only; exit 0. Full captured stdout/stderr:

```text
test_actual_settings_shape_is_ast_only (__main__.PassivePreflightTests) ... ok
test_literal_default_git_and_pause_with_runtime_always_unknown (__main__.PassivePreflightTests) ... ok
test_missing_files_and_syntax_errors_do_not_become_false (__main__.PassivePreflightTests) ... ok
test_missing_nonliteral_and_reassigned_settings_are_unknown (__main__.PassivePreflightTests) ... ok
test_missing_repository_reports_unknown_without_parent_git_discovery (__main__.PassivePreflightTests) ... ok
test_true_source_literal_never_proves_runtime_or_permission (__main__.PassivePreflightTests) ... ok

----------------------------------------------------------------------
Ran 6 tests in 1.118s

OK
```

Exact three-file patch, including usage and tests:

```diff
diff --git a/projects/trading-bot/prototype/README.md b/projects/trading-bot/prototype/README.md
new file mode 100644
index 0000000..1bccc71
--- /dev/null
+++ b/projects/trading-bot/prototype/README.md
@@ -0,0 +1,22 @@
+# Passive Equities source preflight
+
+This standalone Python 3.9+ standard-library tool reports source evidence without importing or executing the inspected project. It preserves the operator pause and never authorizes strategy, infrastructure or trading resumption.
+
+```sh
+python3 preflight.py --repo /Users/sayuj/AI/Claude/equities-desk
+python3 test_preflight.py -v
+```
+
+It reads only five fixed paths: CLAUDE.md, AGENTS.md, README.md, artifacts/reports/context/handoff.md and config/settings.py. Each gets a SHA-256 hash; missing, unreadable, oversized or externally linked files are reported explicitly. No arbitrary extra source path is accepted. Files are capped at 1 MiB. The tool never reads dotenv/credential files, databases, the artifact manifest or Momentum files.
+
+The only child commands are fixed read-only Git root/HEAD/branch/status queries. They disable optional locks, fsmonitor/hooks, global/system configuration and untracked-cache writes. A selected subdirectory cannot inherit its parent repository identity. Submodule worktree state is explicitly not inspected. No desk command, broker/Qanat connector, strategy, backtest, infrastructure or network action runs.
+
+The AST collector recognizes a single unconditional module-level boolean assignment, or the current load_settings return shape: Settings(execution_enabled=_bool(merged.get("EXECUTION_ENABLED"), False)). It reports only the literal source declaration/default argument and its line number. Missing, nonliteral, conditional, unsupported or multiple assignment/candidate forms remain unknown. It does not evaluate helper behavior, process overrides, dynamic Python behavior or the loaded settings cache. This is conservative pattern matching, not a full Python interpreter or a proof of every possible rebinding.
+
+Runtime execution always remains unknown, including when the source literal is false or true. Service and broker status also remain unknown. Dated pause/question excerpts carry file/line/section references. Keyword matches do not establish current operator authority or automatically resolve historical questions; the task boundary always preserves the operator pause. No report is a runtime health check or readiness approval.
+
+Exit 0 means the five allowlisted files and Git metadata were collected. It does not mean execution is disabled, syntax is operationally valid, a service is healthy or the project may resume. AST uncertainties remain explicit even with exit 0. Missing source/repository metadata returns exit 2 with the partial JSON evidence report; invalid arguments return an INVALID_INPUT JSON error on stderr. No report is written into the inspected repository; JSON goes to stdout.
+
+Tests use temporary synthetic Git repositories and inspect their bytes before/after. They cover literal and factory-shaped source defaults, missing/nonliteral/reassigned/conditional settings, missing files/repositories, syntax errors, unknown runtime state even for a true source literal, and top-level code that must never execute. The production-source smoke run was performed with network access and writes to Equities/Momentum denied, and all five inspected hashes plus Git state remained unchanged. No original project tests or operational commands were run.
+
+The next step is an explicit operator answer to the existing pause/infrastructure questions and a separately authorized work plan. Q8 and governed-attempt decisions remain outside this prototype. No attempt was consumed, kill switch altered, artifact manifest written, capital deployed or live readiness asserted.
diff --git a/projects/trading-bot/prototype/preflight.py b/projects/trading-bot/prototype/preflight.py
new file mode 100644
index 0000000..149aeaa
--- /dev/null
+++ b/projects/trading-bot/prototype/preflight.py
@@ -0,0 +1,166 @@
+#!/usr/bin/env python3
+"""Passive source evidence only. Never import or run the inspected project."""
+import ast
+import hashlib
+import json
+import re
+import subprocess
+import sys
+from pathlib import Path
+
+ALLOWLIST = ('CLAUDE.md', 'AGENTS.md', 'README.md', 'artifacts/reports/context/handoff.md', 'config/settings.py')
+SETTING_NAMES = {'EXECUTION_ENABLED', 'execution_enabled'}
+
+
+def source_file(root, relative):
+    path = root / relative
+    try:
+        if not path.exists():
+            return {'status': 'missing', 'sha256': None}, None
+        if path.is_symlink() or root not in path.resolve().parents or not path.is_file():
+            return {'status': 'refused', 'sha256': None, 'reason': 'not a regular allowlisted file inside repository'}, None
+        if path.stat().st_size > 1024 * 1024:
+            return {'status': 'refused', 'sha256': None, 'reason': 'file exceeds 1 MiB'}, None
+        raw = path.read_bytes()
+        return {'status': 'read', 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}, raw.decode('utf-8')
+    except (OSError, UnicodeError):
+        return {'status': 'unreadable', 'sha256': None}, None
+
+
+def git_metadata(root):
+    unknown = {'status': 'unknown', 'branch': None, 'head': None, 'status_porcelain': None}
+    if not root.is_dir():
+        return dict(unknown, reason='repository_directory_missing')
+    base = ['git', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null',
+            '-c', 'core.untrackedCache=false', '-C', str(root)]
+    child_environment = {'PATH': '/usr/bin:/bin', 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_TERMINAL_PROMPT': '0'}
+
+    def run(args):
+        result = subprocess.run(base + args, capture_output=True, text=True, timeout=5, env=child_environment)
+        if result.returncode != 0:
+            raise ValueError('git metadata unavailable')
+        return result.stdout
+
+    try:
+        top = Path(run(['rev-parse', '--show-toplevel']).strip()).resolve()
+        if top != root:
+            return dict(unknown, reason='selected_directory_is_not_repository_root')
+        head = run(['rev-parse', '--verify', 'HEAD']).strip()
+        branch = run(['branch', '--show-current']).strip() or None
+        status = run(['status', '--porcelain=v1', '--untracked-files=normal', '--ignore-submodules=all'])
+        return {'status': 'observed', 'branch': branch, 'head': head, 'status_porcelain': status,
+                'detached_head': branch is None, 'submodule_worktree_status': 'not_inspected'}
+    except (OSError, ValueError, subprocess.TimeoutExpired):
+        return dict(unknown, reason='read_only_git_metadata_unavailable')
+
+
+def target_setting(target):
+    return any((isinstance(n, ast.Name) and n.id in SETTING_NAMES) or
+               (isinstance(n, ast.Attribute) and n.attr in SETTING_NAMES) or
+               (isinstance(n, ast.Subscript) and isinstance(n.slice, ast.Constant) and n.slice.value in SETTING_NAMES)
+               for n in ast.walk(target))
+
+
+def execution_evidence(text):
+    result = {'status': 'unknown', 'value': None, 'reason': 'settings_source_unavailable', 'evidence': [],
+              'interpretation': 'Literal source declaration/default argument only; helper behavior and runtime values are not evaluated.'}
+    if text is None:
+        return result
+    try:
+        tree = ast.parse(text)
+    except SyntaxError:
+        return dict(result, reason='syntax_error')
+    parents = {child: parent for parent in ast.walk(tree) for child in ast.iter_child_nodes(parent)}
+    evidence = []
+
+    def candidate(node, value, supported, kind):
+        literal = isinstance(value, ast.Constant) and type(value.value) is bool
+        evidence.append({'line': node.lineno, 'kind': kind, 'literal_boolean': value.value if literal else None,
+                         'supported_syntax': bool(supported and literal)})
+
+    for node in ast.walk(tree):
+        if isinstance(node, (ast.Assign, ast.AnnAssign, ast.AugAssign, ast.NamedExpr)):
+            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
+            if any(target_setting(t) for t in targets):
+                if isinstance(node, ast.AnnAssign) and node.value is None:
+                    continue  # A typed dataclass field without a value is not a default.
+                supported = isinstance(node, (ast.Assign, ast.AnnAssign)) and isinstance(parents.get(node), ast.Module)
+                supported = supported and len(targets) == 1 and isinstance(targets[0], ast.Name)
+                candidate(node, node.value, supported, 'setting_assignment')
+        elif isinstance(node, ast.keyword) and node.arg == 'execution_enabled':
+            call = parents.get(node)
+            value = node.value
+            supported = isinstance(call, ast.Call) and isinstance(call.func, ast.Name) and call.func.id == 'Settings'
+            owner = call
+            while owner is not None and not isinstance(owner, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Module)):
+                if isinstance(owner, (ast.If, ast.For, ast.While, ast.Try, ast.IfExp)):
+                    supported = False
+                owner = parents.get(owner)
+            supported = supported and isinstance(owner, ast.FunctionDef) and owner.name == 'load_settings'
+            if isinstance(value, ast.Call) and isinstance(value.func, ast.Name) and value.func.id == '_bool' and len(value.args) == 2 and not value.keywords:
+                lookup = value.args[0]
+                valid_lookup = (isinstance(lookup, ast.Call) and isinstance(lookup.func, ast.Attribute) and lookup.func.attr == 'get'
+                                and isinstance(lookup.func.value, ast.Name) and lookup.func.value.id == 'merged'
+                                and len(lookup.args) == 1 and not lookup.keywords
+                                and isinstance(lookup.args[0], ast.Constant) and lookup.args[0].value == 'EXECUTION_ENABLED')
+                candidate(node, value.args[1], supported and valid_lookup, 'Settings.execution_enabled._bool_default_argument')
+            else:
+                candidate(node, value, False, 'unsupported_execution_keyword')
+    result['evidence'] = sorted(evidence, key=lambda e: e['line'])
+    if len(evidence) != 1:
+        result['reason'] = 'missing_setting' if not evidence else 'multiple_assignments_or_candidates'
+    elif not evidence[0]['supported_syntax']:
+        result['reason'] = 'nonliteral_or_unsupported_syntax'
+    else:
+        result.update(status='literal_source_default', value=evidence[0]['literal_boolean'], reason='one_supported_literal_source_candidate')
+    return result
+
+
+def handoff_references(text):
+    pause, questions = [], []
+    section = None
+    if text:
+        for line_number, line in enumerate(text.splitlines(), 1):
+            if line.startswith('## '):
+                section = line[3:]
+            record = {'path': 'artifacts/reports/context/handoff.md', 'line': line_number, 'section': section, 'excerpt': line[:500]}
+            if re.search(r'paused.*operator|operator.*paus', line, re.I):
+                pause.append(record)
+            if re.search(r'unanswered|questions.*operator|Q8 deferred|attempt 2', line, re.I):
+                questions.append(record)
+    return {'status': 'recorded_pause' if pause else 'unknown', 'references': pause,
+            'task_boundary': 'Preserve the operator pause; this task does not authorize strategy or infrastructure resumption.',
+            'authority_rechecked': False}, questions
+
+
+def preflight(root):
+    root = root.resolve()
+    files, texts = {}, {}
+    for relative in ALLOWLIST:
+        files[relative], texts[relative] = source_file(root, relative)
+    git = git_metadata(root)
+    execution = execution_evidence(texts['config/settings.py'])
+    pause, questions = handoff_references(texts['artifacts/reports/context/handoff.md'])
+    return {'schema_version': 1, 'mode': 'passive_source_report', 'repository': str(root),
+            'collection_complete': git['status'] == 'observed' and all(f['status'] == 'read' for f in files.values()),
+            'git': git, 'files': files, 'execution_source_default': execution,
+            'runtime_execution': {'status': 'unknown', 'value': None, 'reason': 'Runtime settings, credentials, process state and dotenv files were not read.'},
+            'service_status': 'unknown', 'broker_status': 'unknown', 'authorizes_resume': False,
+            'operator_pause': pause, 'open_question_references': questions,
+            'reference_limit': 'Dated handoff excerpts are recorded evidence, not proof that historical questions remain unresolved or that operator authority changed.',
+            'limitations': ['No project module import, desk command, broker/Qanat call, database read, strategy or backtest execution.',
+                            'No environment/credential-file read, runtime health probe, attempt consumption, kill-file or artifact-manifest mutation.',
+                            'AST patterns are conservative source evidence, not a Python interpreter or proof of final runtime configuration.',
+                            'Only five fixed allowlisted files and read-only Git metadata are inspected; Momentum is not inspected or changed.']}
+
+
+if __name__ == '__main__':
+    try:
+        if len(sys.argv) != 3 or sys.argv[1] != '--repo':
+            raise ValueError('usage: python3 preflight.py --repo repository-root')
+        report = preflight(Path(sys.argv[2]))
+        print(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False))
+        sys.exit(0 if report['collection_complete'] else 2)
+    except (ValueError, OSError, TypeError) as error:
+        print(json.dumps({'error': {'code': 'INVALID_INPUT', 'message': str(error)}}), file=sys.stderr)
+        sys.exit(2)
diff --git a/projects/trading-bot/prototype/test_preflight.py b/projects/trading-bot/prototype/test_preflight.py
new file mode 100644
index 0000000..0d19e97
--- /dev/null
+++ b/projects/trading-bot/prototype/test_preflight.py
@@ -0,0 +1,98 @@
+import json
+import subprocess
+import sys
+import tempfile
+import unittest
+from pathlib import Path
+
+ROOT = Path(__file__).resolve().parent
+
+
+class PassivePreflightTests(unittest.TestCase):
+    def setUp(self):
+        self.temp = tempfile.TemporaryDirectory()
+        self.repo = Path(self.temp.name) / 'repo'
+        self.repo.mkdir()
+        (self.repo / 'config').mkdir()
+        (self.repo / 'artifacts/reports/context').mkdir(parents=True)
+        for name in ['CLAUDE.md', 'AGENTS.md', 'README.md']:
+            (self.repo / name).write_text('Synthetic passive fixture. No operational commands.\n')
+        (self.repo / 'artifacts/reports/context/handoff.md').write_text('# Handoff\n## 2026-09-10\nStrategy work is paused by the operator.\nInfrastructure questions to the operator remain unanswered.\nQ8 deferred; attempt 2 requires operator decision.\n')
+        self.source('EXECUTION_ENABLED = False\n')
+        subprocess.run(['git', 'init', '-q', '-b', 'main', str(self.repo)], check=True)
+        subprocess.run(['git', '-C', str(self.repo), 'add', '.'], check=True)
+        subprocess.run(['git', '-C', str(self.repo), '-c', 'user.name=Synthetic', '-c', 'user.email=fixture@example.invalid',
+                        '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'Synthetic fixture'], check=True)
+
+    def tearDown(self):
+        self.temp.cleanup()
+
+    def source(self, text):
+        (self.repo / 'config/settings.py').write_text(text)
+
+    def run_cli(self, path=None):
+        before = {str(p): p.read_bytes() for p in self.repo.rglob('*') if p.is_file()}
+        result = subprocess.run([sys.executable, str(ROOT / 'preflight.py'), '--repo', str(path or self.repo)], capture_output=True, text=True)
+        after = {str(p): p.read_bytes() for p in self.repo.rglob('*') if p.is_file()}
+        self.assertEqual(before, after, 'Passive tool changed a source or Git file')
+        return result, json.loads(result.stdout)
+
+    def test_literal_default_git_and_pause_with_runtime_always_unknown(self):
+        result, out = self.run_cli()
+        self.assertEqual(result.returncode, 0, result.stderr)
+        self.assertEqual(out['git']['branch'], 'main')
+        self.assertEqual(len(out['git']['head']), 40)
+        self.assertEqual(out['git']['status_porcelain'], '')
+        self.assertIs(out['execution_source_default']['value'], False)
+        self.assertEqual(out['runtime_execution']['status'], 'unknown')
+        self.assertIsNone(out['runtime_execution']['value'])
+        self.assertEqual(out['operator_pause']['status'], 'recorded_pause')
+        self.assertTrue(out['open_question_references'])
+        self.assertFalse(out['authorizes_resume'])
+
+    def test_actual_settings_shape_is_ast_only(self):
+        self.source('from pathlib import Path\nPath(__file__).with_name("MUST_NOT_EXIST").write_text("executed")\ndef load_settings():\n    return Settings(execution_enabled=_bool(merged.get("EXECUTION_ENABLED"), False))\n')
+        _, out = self.run_cli()
+        self.assertIs(out['execution_source_default']['value'], False)
+        self.assertFalse((self.repo / 'config/MUST_NOT_EXIST').exists())
+
+    def test_missing_nonliteral_and_reassigned_settings_are_unknown(self):
+        for source in ['OTHER = False\n', 'EXECUTION_ENABLED = choose()\n',
+                       'EXECUTION_ENABLED = False\nEXECUTION_ENABLED = True\n',
+                       'if condition:\n    EXECUTION_ENABLED = False\n',
+                       'EXECUTION_ENABLED = False\nEXECUTION_ENABLED |= flag\n',
+                       'def load_settings():\n    return Settings(execution_enabled=_bool(merged.get("EXECUTION_ENABLED"), DEFAULT))\n']:
+            self.source(source)
+            _, out = self.run_cli()
+            self.assertEqual(out['execution_source_default']['status'], 'unknown', source)
+            self.assertIsNone(out['execution_source_default']['value'])
+            self.assertEqual(out['runtime_execution']['status'], 'unknown')
+
+    def test_missing_files_and_syntax_errors_do_not_become_false(self):
+        (self.repo / 'config/settings.py').unlink()
+        result, out = self.run_cli()
+        self.assertEqual(result.returncode, 2)
+        self.assertEqual(out['files']['config/settings.py']['status'], 'missing')
+        self.assertIsNone(out['execution_source_default']['value'])
+        self.source('def broken(:\n')
+        _, out = self.run_cli()
+        self.assertEqual(out['execution_source_default']['reason'], 'syntax_error')
+
+    def test_missing_repository_reports_unknown_without_parent_git_discovery(self):
+        result, out = self.run_cli(self.repo / 'absent')
+        self.assertEqual(result.returncode, 2)
+        self.assertEqual(out['git']['status'], 'unknown')
+        self.assertIsNone(out['runtime_execution']['value'])
+        result, out = self.run_cli(self.repo / 'config')
+        self.assertEqual(out['git']['status'], 'unknown')
+
+    def test_true_source_literal_never_proves_runtime_or_permission(self):
+        self.source('EXECUTION_ENABLED = True\n')
+        _, out = self.run_cli()
+        self.assertIs(out['execution_source_default']['value'], True)
+        self.assertIsNone(out['runtime_execution']['value'])
+        self.assertFalse(out['authorizes_resume'])
+
+
+if __name__ == '__main__':
+    unittest.main()
```
