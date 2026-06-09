import { isPathInside } from './safe-file-walker';

describe('isPathInside', () => {
  it('accepts a child path', () => {
    expect(isPathInside('C:\\Temp', 'C:\\Temp\\nested\\file.tmp')).toBe(true);
  });

  it('rejects the root itself', () => {
    expect(isPathInside('C:\\Temp', 'C:\\Temp')).toBe(false);
  });

  it('rejects sibling and traversal paths', () => {
    expect(isPathInside('C:\\Temp', 'C:\\Temp-Other\\file.tmp')).toBe(false);
    expect(isPathInside('C:\\Temp', 'C:\\Temp\\..\\Windows\\file.tmp')).toBe(
      false,
    );
  });
});
