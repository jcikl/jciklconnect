import { FieldValue } from 'firebase-admin/firestore';
import { auth, db } from '../lib/firebaseAdmin.mjs';
import { makePublicDirectoryPhotoHandler } from '../lib/publicDirectoryPhoto.mjs';

export default makePublicDirectoryPhotoHandler({ auth, db, deleteField: () => FieldValue.delete() });
