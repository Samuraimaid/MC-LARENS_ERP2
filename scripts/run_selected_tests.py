import os
import sys
import pytest

os.environ['REACT_APP_BACKEND_URL'] = 'http://127.0.0.1:8002'

# Tests to run
tests = [
    'tests/test_backend_api.py::TestRootAndSeed::test_root_endpoint',
    'tests/test_backend_api.py::TestRootAndSeed::test_seed_endpoint',
]

ret = pytest.main(['-q'] + tests)
if ret != 0:
    print('Some tests failed')
    sys.exit(ret)
print('Selected tests passed')
