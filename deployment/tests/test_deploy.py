import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'cd.sh'
OLD = 'docker.io/test/radar@sha256:' + 'a' * 64
NEW = 'docker.io/test/radar@sha256:' + 'b' * 64

class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.old = self.root / 'releases/old'
        self.new = self.root / 'releases/new'
        for release in [self.old, self.new]:
            release.mkdir(parents=True)
            (release / 'compose.yaml').write_text('services: {}\n')
        shutil.copy(SCRIPT, self.new / 'cd.sh')
        (self.old / 'image.env').write_text('RADAR_IMAGE=' + OLD + '\n')
        (self.root / '.env').write_text('DATABASE_URL=private-test-value\n')
        (self.root / 'current').symlink_to(self.old)
        binary = self.root / 'bin'
        binary.mkdir()
        docker = binary / 'docker'
        docker.write_text('''#!/usr/bin/env bash
printf '%s %s\\n' "$RADAR_IMAGE" "$*" >> "$TEST_LOG"
if [[ "$RADAR_IMAGE" == "$NEW_IMAGE" && "$*" == *"${FAIL_COMMAND:-never-match}"* ]]; then exit 12; fi
''')
        docker.chmod(0o700)
        self.env = dict(os.environ, RADAR_DEPLOY_ROOT=str(self.root), TEST_LOG=str(self.root / 'commands'), NEW_IMAGE=NEW, PATH=str(binary) + ':' + os.environ['PATH'])
    def run_deploy(self, failure=None, image=NEW):
        if failure:
            self.env['FAIL_COMMAND'] = failure
        return subprocess.run(['bash', str(self.new / 'cd.sh'), image], env=self.env, text=True, capture_output=True)
    def test_success_promotes_only_after_healthcheck(self):
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.root / 'current').resolve(), self.new)
        self.assertIn(NEW, (self.new / 'image.env').read_text())
        self.assertEqual((self.root / '.env').read_text(), 'DATABASE_URL=private-test-value\n')
        commands = (self.root / 'commands').read_text()
        self.assertLess(commands.index(' pull'), commands.index(' stop worker'))
        self.assertLess(commands.index('scripts/migrate.ts'), commands.index(' up -d'))
        self.assertIn(' exec -T web', commands)
    def test_failed_health_restores_previous_release(self):
        result = self.run_deploy(' up -d')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.root / 'current').resolve(), self.old)
        lines = (self.root / 'commands').read_text().splitlines()
        self.assertTrue(any(line.startswith(OLD) and ' up -d' in line for line in lines))
    def test_pull_failure_does_not_stop_running_services(self):
        result = self.run_deploy(' pull')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn(' stop ', (self.root / 'commands').read_text())
        self.assertEqual((self.root / 'current').resolve(), self.old)
    def test_migration_or_api_failure_restores_previous_release(self):
        for failure in ['scripts/migrate.ts', ' exec -T web']:
            with self.subTest(failure=failure):
                result = self.run_deploy(failure)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual((self.root / 'current').resolve(), self.old)
                lines = (self.root / 'commands').read_text().splitlines()
                self.assertTrue(any(line.startswith(OLD) and ' up -d' in line for line in lines))
                (self.root / 'commands').unlink()
    def test_missing_current_metadata_requires_inspection(self):
        (self.old / 'image.env').unlink()
        result = self.run_deploy()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / 'commands').exists())
    def test_first_deploy_failure_stops_failed_containers(self):
        (self.root / 'current').unlink()
        result = self.run_deploy(' up -d')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / 'current').exists())
        self.assertIn(' stop', (self.root / 'commands').read_text())
    def test_untrusted_image_rejected_before_docker(self):
        result = self.run_deploy(image='test/radar:latest; touch /tmp/no')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / 'commands').exists())

if __name__ == '__main__':
    unittest.main()
