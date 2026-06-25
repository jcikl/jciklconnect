/**
 * recursivley removes undefined values from an object.
 * Firestore does not support 'undefined' values, so this helper is essential
 * before saving data to Firestore.
 */
export const removeUndefined = (obj: any): any => {
    if (obj === null || obj === undefined) {
        return null;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => removeUndefined(item)).filter((item) => item !== undefined);
    }

    if (typeof obj === 'object') {
        // Handle Date and Timestamp objects by returning them as is
        if (obj instanceof Date || (obj.toDate && typeof obj.toDate === 'function')) {
            return obj;
        }

        const newObj: any = {};
        Object.keys(obj).forEach((key) => {
            const value = removeUndefined(obj[key]);
            if (value !== undefined) {
                newObj[key] = value;
            }
        });
        return newObj;
    }

    return obj;
};
