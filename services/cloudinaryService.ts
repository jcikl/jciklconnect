/**
 * Cloudinary Upload Service
 */
import imageCompression from 'browser-image-compression';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'drpa1zcmp';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'jciklconnect';
const MEMBER_AVATAR_ASSET_ROOT = import.meta.env.VITE_CLOUDINARY_MEMBER_AVATAR_ASSET_ROOT || 'jciklconnect';

type MemberAvatarFolderSource = {
  id?: string;
  name?: string;
  fullName?: string;
  general?: {
    name?: string;
    fullName?: string;
  };
};

const sanitizePathSegment = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const sanitizeFolderPath = (folder: string): string => {
  const safeFolder = folder
    .split('/')
    .map((segment) => sanitizePathSegment(segment))
    .filter(Boolean)
    .join('/');

  return safeFolder;
};

export const getMemberAvatarKey = (member: MemberAvatarFolderSource): string => {
  const memberName = member.name || member.fullName || member.general?.name || member.general?.fullName || member.id || 'member';
  const memberIdLast4 = (member.id || '').replace(/[^a-z0-9]/gi, '').slice(-4).toLowerCase();

  return `${sanitizePathSegment(memberName)}-${memberIdLast4 || 'unknown'}`;
};

export const getMemberAvatarFolder = (member: MemberAvatarFolderSource): string => {
  return `${sanitizePathSegment(MEMBER_AVATAR_ASSET_ROOT)}/members/${getMemberAvatarKey(member)}/avatar`;
};

export const uploadMemberAvatarToCloudinary = async (
  file: File,
  member: MemberAvatarFolderSource,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const compressedFile = await imageCompression(file, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 1024,
    useWebWorker: false,
  });

  const folder = getMemberAvatarFolder(member);
  const avatarKey = getMemberAvatarKey(member);
  const uniqueId = `${avatarKey}-${Math.floor(Date.now() / 1000)}`;

  return uploadToCloudinary(compressedFile, folder, onProgress, {
    publicId: uniqueId,
  });
};

export const uploadBoardAvatarToCloudinary = async (
  file: File,
  member: MemberAvatarFolderSource,
  term: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const compressedFile = await imageCompression(file, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 1024,
    useWebWorker: false,
  });

  const memberKey = getMemberAvatarKey(member);
  const folder = `${sanitizeFolderPath(MEMBER_AVATAR_ASSET_ROOT)}/board-directors/${sanitizePathSegment(term)}`;
  const publicId = `${memberKey}-${Math.floor(Date.now() / 1000)}`;

  return uploadToCloudinary(compressedFile, folder, onProgress, { publicId });
};

export const uploadPresidentialLogoToCloudinary = async (
  file: File,
  term: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const compressedFile = await imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 800,
    useWebWorker: false,
  });

  const folder = `${sanitizeFolderPath(MEMBER_AVATAR_ASSET_ROOT)}/presidential-logos`;
  const publicId = `${sanitizePathSegment(term)}-logo`;

  return uploadToCloudinary(compressedFile, folder, onProgress, { publicId });
};

/**
 * Uploads a file directly to Cloudinary using unsigned upload with progress tracking.
 * @param file - The file to upload (e.g. image)
 * @param folder - Optional Cloudinary folder path
 * @param onProgress - Optional callback function to track upload progress (0-100)
 * @returns The secure URL of the uploaded image
 */
export const uploadToCloudinary = (
  file: File,
  folder?: string,
  onProgress?: (progress: number) => void,
  options?: {
    publicId?: string;
  }
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    if (folder) {
      formData.append('folder', folder);
      formData.append('asset_folder', folder);
    }
    if (options?.publicId) {
      formData.append('public_id', sanitizePathSegment(options.publicId));
    }

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
    xhr.open('POST', url, true);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response.secure_url);
        } catch (e) {
          reject(new Error('Failed to parse Cloudinary response'));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          console.error('Cloudinary upload failed:', errorData);
          reject(new Error(errorData.error?.message || 'Failed to upload image to Cloudinary'));
        } catch (e) {
          console.error('Cloudinary upload failed:', xhr.responseText);
          reject(new Error(`Failed to upload to Cloudinary (status ${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred during Cloudinary upload'));
    };

    xhr.send(formData);
  });
};

/**
 * Extracts the public ID of an asset from its Cloudinary URL.
 * @param url - The secure URL of the Cloudinary asset
 * @returns The public ID or null if parsing fails
 */
export const getPublicIdFromUrl = (url: string): string | null => {
  try {
    const parts = url.split('/image/upload/');
    if (parts.length < 2) return null;
    
    let path = parts[1];
    const firstSlashIndex = path.indexOf('/');
    if (firstSlashIndex !== -1) {
      const maybeVersion = path.substring(0, firstSlashIndex);
      if (maybeVersion.startsWith('v') && /^\d+$/.test(maybeVersion.substring(1))) {
        path = path.substring(firstSlashIndex + 1);
      }
    }
    
    const dotIndex = path.lastIndexOf('.');
    if (dotIndex !== -1) {
      path = path.substring(0, dotIndex);
    }
    
    return decodeURIComponent(path);
  } catch (err) {
    console.error('Failed to parse Cloudinary public ID:', err);
    return null;
  }
};

/**
 * Generates an SHA-1 signature for Cloudinary requests using native browser Web Crypto API.
 */
const generateSignature = async (
  params: Record<string, string>,
  apiSecret: string
): Promise<string> => {
  const sortedKeys = Object.keys(params).sort();
  const sortedString = sortedKeys
    .map((key) => `${key}=${params[key]}`)
    .join('&') + apiSecret;

  const encoder = new TextEncoder();
  const data = encoder.encode(sortedString);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex;
};

/**
 * Deletes an image from Cloudinary using the secure destroy endpoint.
 * @param url - The secure URL of the image to delete
 * @returns A promise resolving to true if successful, false otherwise
 */
export const deleteFromCloudinary = async (url: string): Promise<boolean> => {
  const publicId = getPublicIdFromUrl(url);
  if (!publicId) return false;

  const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY;
  const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.warn(
      'Cloudinary API Key or API Secret is missing. Skipping Cloudinary asset deletion.'
    );
    return false;
  }

  try {
    const timestamp = Math.round(new Date().getTime() / 1000).toString();
    const params: Record<string, string> = {
      public_id: publicId,
      timestamp: timestamp,
    };

    const signature = await generateSignature(params, apiSecret);

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await response.json();
    return data.result === 'ok';
  } catch (err) {
    console.error('Failed to delete image from Cloudinary:', err);
    return false;
  }
};
