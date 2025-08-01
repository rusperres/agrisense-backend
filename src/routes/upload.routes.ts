import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary';
import { protect } from '../middlewares/auth.middleware';
import { UserRole } from '../types/enums';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
];

const UPLOAD_ALLOWED_ROLES = [UserRole.Seller, UserRole.Admin];

router.post('/single', protect(UPLOAD_ALLOWED_ROLES), upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            res.status(400).json({ message: 'No file uploaded.' });
            return;
        }

        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'User not authenticated or userId not found.' });
            return;
        }

        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            res.status(400).json({ message: 'Invalid file type.' });
            return;
        }

        const maxSize = 10 * 1024 * 1024;
        if (req.file.size > maxSize) {
            res.status(400).json({ message: `File size exceeds the limit of ${maxSize / (1024 * 1024)}MB.` });
            return;
        }

        const b64 = Buffer.from(req.file.buffer).toString('base64');
        let dataURI = 'data:' + req.file.mimetype + ';base64,' + b64;

        const folderPath = `agrikart/${userId}`;

        const result = await cloudinary.uploader.upload(dataURI, {
            folder: folderPath,
            resource_type: "auto",
        });

        res.status(200).json({
            message: 'File uploaded successfully!',
            url: result.secure_url,
            public_id: result.public_id,
            fileType: result.resource_type,
        });

    } catch (error) {
        console.error('Error uploading file to Cloudinary:', error);
        res.status(500).json({ message: 'File upload failed.', error: error instanceof Error ? error.message : String(error) });
    }
});

router.post('/multiple', protect(UPLOAD_ALLOWED_ROLES), upload.array('files', 10), async (req: Request, res: Response) => {
    try {
        if (!req.files || req.files.length === 0) {
            res.status(400).json({ message: 'No files uploaded.' });
            return;
        }

        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'User not authenticated or userId not found.' });
            return;
        }

        const uploadedResults = [];
        const folderPath = `agrikart/${userId}`;

        for (const file of (req.files as Express.Multer.File[])) {
            if (!allowedMimeTypes.includes(file.mimetype)) {
                console.warn(`Skipping invalid file type: ${file.mimetype} for ${file.originalname}`);
                continue;
            }
            const b64 = Buffer.from(file.buffer).toString('base64');
            let dataURI = 'data:' + file.mimetype + ';base64,' + b64;

            const result = await cloudinary.uploader.upload(dataURI, {
                folder: folderPath,
                resource_type: "auto",
            });
            uploadedResults.push({
                url: result.secure_url,
                public_id: result.public_id,
                name: file.originalname,
                fileType: result.resource_type,
            });
        }

        res.status(200).json({
            message: 'Files uploaded successfully!',
            results: uploadedResults,
        });

    } catch (error) {
        console.error('Error uploading multiple files to Cloudinary:', error);
        res.status(500).json({ message: 'Multiple file upload failed.', error: error instanceof Error ? error.message : String(error) });
        return;
    }
});

export default router;