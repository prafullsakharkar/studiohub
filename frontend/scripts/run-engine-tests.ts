import { TestRunnerEngine } from '../src/core/testing/TestRunnerEngine';

async function main() {
  console.log('Running TestRunnerEngine test groups...');
  const groups = TestRunnerEngine.getTestGroups();
  let passed = 0;
  let failed = 0;
  const failures: { id: string; name: string; error: any }[] = [];

  for (const group of groups) {
    console.log(`\nGroup: ${group.title} (${group.tests.length} tests)`);
    for (const test of group.tests) {
      try {
        const res = await test.run();
        if (res.passed) {
          passed++;
          process.stdout.write(`  ✓ ${test.name} (${res.durationMs}ms)\n`);
        } else {
          failed++;
          failures.push({ id: test.id, name: test.name, error: res.message || res.error });
          process.stdout.write(`  ✗ ${test.name}: ${res.message}\n`);
        }
      } catch (err: any) {
        failed++;
        failures.push({ id: test.id, name: test.name, error: err.message || String(err) });
        process.stdout.write(`  ✗ ${test.name} (threw): ${err.message}\n`);
      }
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
  if (failures.length > 0) {
    console.error('\nFailures breakdown:');
    failures.forEach((f) => console.error(`- [${f.id}] ${f.name}: ${f.error}`));
  }
}

main().catch(console.error);
