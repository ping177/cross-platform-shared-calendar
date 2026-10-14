export const avatarPresets = [
  { id: 'cat', label: '猫', group: 'animal' }, { id: 'rabbit', label: '兔', group: 'animal' },
  { id: 'bear', label: '熊', group: 'animal' }, { id: 'fox', label: '狐狸', group: 'animal' },
  { id: 'dog', label: '狗', group: 'animal' }, { id: 'bird', label: '鸟', group: 'animal' },
  { id: 'flower', label: '花', group: 'nature' }, { id: 'leaf', label: '枝叶', group: 'nature' },
  { id: 'moon', label: '月', group: 'nature' }, { id: 'star', label: '星', group: 'nature' },
  { id: 'cloud', label: '云', group: 'nature' }, { id: 'sun', label: '日光', group: 'nature' },
] as const;

export const avatarBucket = 'profile-avatars';
export const avatarSignedSeconds = 300;
export const avatarUploadMaxBytes = 1024 * 1024;
export function avatarPreset(id: string | null | undefined) { return avatarPresets.find((preset) => preset.id === id); }
const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export function isAvatarPath(path: string | null | undefined, userId: string) {
  return Boolean(path && new RegExp(`^${uuidPattern}/${uuidPattern}\\.jpg$`).test(path) && path.split('/')[0] === userId);
}
export function validateAvatarFile(file: Pick<File, 'type' | 'size'>) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPEG、PNG 或 WebP 图片。');
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('图片大小须在 10 MB 以内。');
}

export async function prepareAvatarPhoto(file: File): Promise<Blob> {
  validateAvatarFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    const { naturalWidth: width, naturalHeight: height } = image;
    if (!width || !height || width * height > 60_000_000) throw new Error('图片尺寸过大，请选择较小的图片。');
    const side = Math.min(width, height);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法处理图片，请换一张照片重试。');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 512, 512);
    context.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, 0, 0, 512, 512);
    const photo = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法处理图片。')), 'image/jpeg', .86));
    if (photo.size > avatarUploadMaxBytes) throw new Error('处理后的图片过大，请换一张照片重试。');
    return photo;
  } catch (failure) {
    if (failure instanceof Error && !(failure instanceof DOMException)) throw failure;
    throw new Error('无法读取图片，请选择 JPEG、PNG 或 WebP 照片。');
  } finally { URL.revokeObjectURL(url); }
}
