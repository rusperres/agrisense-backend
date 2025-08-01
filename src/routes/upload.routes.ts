// backend/src/routes/upload.routes.ts
import express, { Request, Response, NextFunction } from 'express'; // Import Request, Response, NextFunction
import multer from 'multer';
import cloudinary from '../config/cloudinary';
import { protect } from '../middlewares/auth.middleware';
import { UserRole } from '../types/enums';
import { AuthenticatedRequest } from '../types/express'; // <-- Import AuthenticatedRequest

const router = express.Router();

// Configure Multer for in-memory storage. Files will be buffered and then sent to Cloudinary.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Define allowed MIME types for both product images and verification documents
const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
];

// Roles allowed to upload files
// Assuming FARMERs upload product images/verification docs, and ADMINs can too.
const UPLOAD_ALLOWED_ROLES = [UserRole.Seller, UserRole.Admin]; // Adjust roles as per your application logic

// POST /api/upload/single
// Apply the 'protect' middleware with allowed roles
router.post('/single', protect(UPLOAD_ALLOWED_ROLES), upload.single('file'), async (req: AuthenticatedRequest, res: Response) => { // <-- Explicitly type req
    try {
        if (!req.file) {
            res.status(400).json({ message: 'No file uploaded.' });
            return;
        }

        // Access the userId from req.user (set by authenticateUser middleware)
        const userId = req.user?.id;
        if (!userId) {
            // This case should ideally be caught by authenticateUser, but as a safeguard
            res.status(401).json({ message: 'User not authenticated or userId not found.' });
            return;
        }

        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            res.status(400).json({ message: 'Invalid file type.' });
            return;
        }

        const maxSize = 10 * 1024 * 1024; // 10 MB
        if (req.file.size > maxSize) {
            res.status(400).json({ message: `File size exceeds the limit of ${maxSize / (1024 * 1024)}MB.` });
            return;
        }

        const b64 = Buffer.from(req.file.buffer).toString('base64');
        let dataURI = 'data:' + req.file.mimetype + ';base64,' + b64;

        // Construct dynamic folder path: agrikart/user_id/
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

// POST /api/upload/multiple
// Apply the 'protect' middleware with allowed roles
router.post('/multiple', protect(UPLOAD_ALLOWED_ROLES), upload.array('files', 10), async (req: AuthenticatedRequest, res: Response) => { // <-- Explicitly type req
    try {
        if (!req.files || req.files.length === 0) {
            res.status(400).json({ message: 'No files uploaded.' });
            return;
        }

        // Access the userId from req.user
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