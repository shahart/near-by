import sys
import types
import unittest

# stub boto3 to allow importing lambda_function in environments without boto3
sys.modules.setdefault('boto3', types.SimpleNamespace(resource=lambda *a, **k: None))

from lambda_function import nearDistance


class TestNearDistance(unittest.TestCase):
    def test_same_point(self):
        self.assertTrue(nearDistance('31.2_35.5', '31.2_35.5'))

    def test_separators(self):
        self.assertTrue(nearDistance('31.2_35.5', '31.2,35.5'))
        self.assertTrue(nearDistance('31.2_35.5', '31.2 35.5'))

    def test_list_tuple_inputs(self):
        self.assertTrue(nearDistance([31.2, 35.5], (31.2, 35.5)))

    def test_threshold_behavior(self):
        # ~111m per 0.001 degree latitude. 0.001 -> ~111m -> True
        self.assertTrue(nearDistance('31.200_35.500', '31.201_35.500'))
        # 0.002 -> ~222m -> False (default threshold 200m)
        self.assertFalse(nearDistance('31.200_35.500', '31.202_35.500'))

    def test_invalid_inputs(self):
        self.assertFalse(nearDistance(None, '31.2_35.5'))
        self.assertFalse(nearDistance('not_a_coord', '31.2_35.5'))


if __name__ == '__main__':
    unittest.main()
