import SMPGenerator from '../src/main/smpGenerator';
import { convertMBTilesToSMP } from '../src/main/mbtilesConverter';

// Mock the mbtilesConverter module
jest.mock('../src/main/mbtilesConverter', () => ({
  convertMBTilesToSMP: jest.fn().mockResolvedValue(undefined),
}));

describe('fromMbtiles', () => {
  let smpGenerator: SMPGenerator;
  let mockConvertMBTilesToSMP: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize the SMP generator
    smpGenerator = new SMPGenerator();
    mockConvertMBTilesToSMP = jest.mocked(convertMBTilesToSMP);
  });

  it('should convert MBTiles to SMP format', async () => {
    // Call the function
    const mbtilesPath = '/path/to/test.mbtiles';
    const outputPath = '/path/to/output.smp';

    await smpGenerator.fromMbtiles(mbtilesPath, outputPath);

    // Verify that convertMBTilesToSMP was called with the correct parameters
    expect(mockConvertMBTilesToSMP).toHaveBeenCalledWith(
      mbtilesPath,
      outputPath,
    );
  });

  it('should handle errors during conversion', async () => {
    // Call the function
    const mbtilesPath = '/path/to/test.mbtiles';
    const outputPath = '/path/to/output.smp';
    const errorMessage = 'Conversion error';

    // Mock the convertMBTilesToSMP function to throw an error
    mockConvertMBTilesToSMP.mockRejectedValueOnce(new Error(errorMessage));

    // Expect the function to reject with the correct error message
    await expect(
      smpGenerator.fromMbtiles(mbtilesPath, outputPath),
    ).rejects.toThrow(errorMessage);
  });
});
