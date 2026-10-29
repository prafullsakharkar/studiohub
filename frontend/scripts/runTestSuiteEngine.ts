import { TestRunnerEngine } from '../src/core/testing/TestRunnerEngine';

async function runAllSuites() {
  console.log('🚀 Executing TestRunnerEngine Test Suite...');
  const groups = TestRunnerEngine.getTestGroups();
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failures: { group: string; test: string; error: any }[] = [];

  for (const group of groups) {
    console.log(`\n📁 [Group] ${group.title} (${group.tests.length} tests)`);
    for (const test of group.tests) {
      totalTests++;
      try {
        const result = await test.run();
        if (result.passed) {
          passedTests++;
          console.log(`  ✅ [PASS] ${test.name} (${result.durationMs}ms)`);
        } else {
          failedTests++;
          console.error(`  ❌ [FAIL] ${test.name}: ${result.message}`);
          failures.push({ group: group.title, test: test.name, error: result.message });
        }
      } catch (err: any) {
        failedTests++;
        console.error(`  ❌ [ERROR] ${test.name}:`, err.message || err);
        failures.push({ group: group.title, test: test.name, error: err.message || err });
      }
    }
  }

  console.log('\n==========================================');
  console.log(`📊 Summary: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('==========================================\n');

  if (failedTests > 0) {
    console.log('❌ Failures breakdown:');
    failures.forEach((f) => console.log(` - [${f.group}] ${f.test}: ${f.error}`));
    process.exit(1);
  } else {
    console.log('🎉 ALL TEST SUITES PASSED WITH 100% SUCCESS RATE!');
    process.exit(0);
  }
}

runAllSuites().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
