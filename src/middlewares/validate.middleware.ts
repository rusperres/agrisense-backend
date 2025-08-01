import { RequestHandler } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CropListingStatus, MessageType, OrderStatus, PaymentMethod, ProductCondition, ReportStatus, ReportTargetType, ReportType, VerificationStatus } from '../types/enums';


export const validateRegister: RequestHandler[] = [
    body('name').notEmpty().withMessage('Name is required'),
    body('phone').notEmpty().withMessage('Phone number is required')
        .isMobilePhone('any', { strictMode: false })
        .withMessage('Valid phone number is required'),

    body('email').optional().isEmail().withMessage('Valid email is required if provided'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['buyer', 'seller']).withMessage('Role must be buyer or seller'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateLogin: RequestHandler[] = [
    body('phone').notEmpty().withMessage('Phone number is required')
        .isMobilePhone('any', { strictMode: false })
        .withMessage('Valid phone number is required'),
    body('password').notEmpty().withMessage('Password is required'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateUpdateProfile: RequestHandler[] = [
    // Name is optional for update, but if provided, validate length
    body('name')
        .optional()
        .isString().withMessage('Name must be a string')
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),

    // Email is optional for update, but if provided, validate format and uniqueness (except for current user)
    body('email')
        .optional()
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),

    // Phone is optional for update, but if provided, validate format and uniqueness (except for current user)
    body('phone')
        .optional()
        .isMobilePhone('any', { strictMode: false }).withMessage('Invalid phone number format'),

    // Location address is nested, so check if location object exists and then its address
    body('location.address')
        .optional()
        .isString().withMessage('Address must be a string')
        .trim()
        .isLength({ min: 5, max: 255 }).withMessage('Address must be between 5 and 255 characters'),

    // Middleware to check for validation errors
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateUpdateUserLocation: RequestHandler[] = [
    body('lat')
        .optional()
        .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be a valid number between -90 and 90'),
    body('lng')
        .optional()
        .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be a valid number between -180 and 180'),
    body('address')
        .optional()
        .isString().withMessage('Address must be a string')
        .trim()
        .isLength({ min: 5, max: 255 }).withMessage('Address must be between 5 and 255 characters'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }
        next();
    }) as RequestHandler
];

export const validateUpdateEWalletDetails: RequestHandler[] = [
    body('provider')
        .optional()
        .isString().withMessage('Provider must be a string')
        .trim()
        .isLength({ min: 1, max: 50 }).withMessage('Provider must be between 1 and 50 characters'),
    body('accountNumber')
        .optional()
        .isString().withMessage('Account number must be a string')
        .trim()
        .isLength({ min: 5, max: 100 }).withMessage('Account number must be between 5 and 100 characters'),
    body('accountName')
        .optional()
        .isString().withMessage('Account name must be a string')
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Account name must be between 1 and 100 characters'),
    body('qrCodeImage')
        .optional()
        .isString().withMessage('QR Code Image must be a string (URL or base64)')
        .custom((value, { req }) => {
            if (value === null && req.body.qrCodeImage !== undefined) { // Allows explicit null
                return true;
            }
            if (typeof value === 'string' && value.length > 0) {
                return true;
            }
            return false; // For cases like empty string, but `isLength` handles min
        })
        .withMessage('QR Code Image must be a valid URL/base64 string or null'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }
        next();
    }) as RequestHandler
];

export const validateSellerVerification: RequestHandler[] = [
    body('businessName').notEmpty().withMessage('Business name is required.')
        .isString().trim().withMessage('Business name must be a string.'),
    body('credentials.documents').isArray({ min: 1 }).withMessage('At least one document URL is required.'),
    body('credentials.documents.*').isURL().withMessage('Document URLs must be valid URLs.'),
    body('verificationStatus').isIn(Object.values(VerificationStatus)).withMessage('Invalid verification status.'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateCreateProduct: RequestHandler[] = [
    body('name').notEmpty().withMessage('Product name is required'),
    body('variety').optional().isString().withMessage('Variety must be a string or null'),
    body('quantity').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    body('unit').notEmpty().withMessage('Unit is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('description').optional().isString().withMessage('Description must be a string or null'),
    body('harvest_date').optional().isString().withMessage('Harvest date must be a string (ISO 8601 format) or null')
        .custom((value: string | null) => {
            if (value === null) return true;
            // Basic ISO 8601 check, a more robust check might involve parsing Date
            return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/.test(value);
        }).withMessage('Harvest date must be a valid ISO 8601 string or null'),
    body('location').optional().isObject().withMessage('Location must be an object or null'),
    body('location.lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    body('location.lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
    body('location.address').optional().isString().withMessage('Address must be a string or null'),
    body('category').notEmpty().withMessage('Category is required'),
    body('images').optional().isArray().withMessage('Images must be an array of strings or null')
        .custom((value: string[] | null) => {
            if (value === null) return true;
            if (Array.isArray(value)) {
                return value.every(item => typeof item === 'string' && item.length > 0);
            }
            return false;
        }).withMessage('Each image URL must be a non-empty string'),
    body('condition').optional().isIn(Object.values(ProductCondition)).withMessage(`Condition must be one of: ${Object.values(ProductCondition).join(', ')}`),
    body('is_active').isBoolean().withMessage('is_active must be a boolean'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateUpdateProduct: RequestHandler[] = [
    // All fields are optional for an update
    body('name').optional().isString().withMessage('Product name must be a string'),
    body('variety').optional().isString().withMessage('Variety must be a string or null'),
    body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
    body('unit').optional().isString().withMessage('Unit must be a string'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('description').optional().isString().withMessage('Description must be a string or null'),
    body('harvest_date').optional().isString().withMessage('Harvest date must be a string (ISO 8601 format) or null')
        .custom((value: string | null) => {
            if (value === null) return true;
            return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/.test(value);
        }).withMessage('Harvest date must be a valid ISO 8601 string or null'),
    body('location').optional().isObject().withMessage('Location must be an object or null'),
    body('location.lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    body('location.lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
    body('location.address').optional().isString().withMessage('Address must be a string or null'),
    body('category').optional().isString().withMessage('Category must be a string'),
    body('images').optional().isArray().withMessage('Images must be an array of strings or null')
        .custom((value: string[] | null) => {
            if (value === null) return true;
            if (Array.isArray(value)) {
                return value.every(item => typeof item === 'string' && item.length > 0);
            }
            return false;
        }).withMessage('Each image URL must be a non-empty string'),
    body('condition').optional().isIn(Object.values(ProductCondition)).withMessage(`Condition must be one of: ${Object.values(ProductCondition).join(', ')}`),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateProductId: RequestHandler[] = [
    param('id').isUUID().withMessage('Invalid product ID format.'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateAddToCart: RequestHandler[] = [
    body('productId')
        .notEmpty().withMessage('Product ID is required')
        .isUUID().withMessage('Product ID must be a valid UUID'), // Assuming product IDs are UUIDs
    body('quantity')
        .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),

    // Middleware to check for validation errors
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateRemoveCartItem: RequestHandler[] = [
    param('itemId')
        .notEmpty().withMessage('Cart item ID is required')
        .isUUID().withMessage('Cart item ID must be a valid UUID'), // Assuming cart item IDs are UUIDs

    // Middleware to check for validation errors
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateUpdateCartItemQuantity: RequestHandler[] = [
    param('itemId')
        .notEmpty().withMessage('Cart item ID is required')
        .isUUID().withMessage('Cart item ID must be a valid UUID'), // Assuming cart item IDs are UUIDs
    body('quantity')
        .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'), // Quantity must be at least 1

    // Middleware to check for validation errors
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];


export const validatePlaceOrder: RequestHandler[] = [
    // Validate the 'items' array
    body('items')
        .isArray({ min: 1 }).withMessage('At least one item is required to place an order'),

    // Validate each item in the 'items' array.
    body('items.*.product_id')
        .notEmpty().withMessage('Product ID is required for each item')
        .isUUID().withMessage('Product ID must be a valid UUID'),
    body('items.*.quantity')
        .isInt({ min: 1 }).withMessage('Quantity must be a positive integer for each item'),

    // The frontend payload uses 'payment_method', so the middleware should check for that.
    body('payment_method')
        .isIn(Object.values(PaymentMethod)).withMessage(`Payment method must be one of: ${Object.values(PaymentMethod).join(', ')}`),

    body('delivery_location')
        .exists().withMessage('Delivery location is required'), // Ensures the object itself is present
    body('delivery_location.lat')
        .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be a valid number between -90 and 90'),
    body('delivery_location.lng')
        .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be a valid number between -180 and 180'),
    body('delivery_location.address')
        .optional({ nullable: true }).isString().withMessage('Address must be a string or null'),

    // Custom middleware to handle validation results
    ((req, res, next) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateUpdateOrderStatus: RequestHandler[] = [
    param('id') // The order ID comes from the URL parameter
        .notEmpty().withMessage('Order ID is required')
        .isUUID().withMessage('Order ID must be a valid UUID'),
    body('status')
        .notEmpty().withMessage('Order status is required')
        .isIn(Object.values(OrderStatus)).withMessage(`Status must be one of: ${Object.values(OrderStatus).join(', ')}`),

    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateCreateReview: RequestHandler[] = [
    body('orderId')
        .notEmpty().withMessage('Order ID is required')
        .isUUID().withMessage('Order ID must be a valid UUID'),
    body('productId')
        .notEmpty().withMessage('Product ID is required')
        .isUUID().withMessage('Product ID must be a valid UUID'),
    body('productName')
        .notEmpty().withMessage('Product name is required')
        .isString().withMessage('Product name must be a string'),
    body('buyerId')
        .notEmpty().withMessage('Buyer ID is required')
        .isUUID().withMessage('Buyer ID must be a valid UUID'),
    body('sellerId')
        .notEmpty().withMessage('Seller ID is required')
        .isUUID().withMessage('Seller ID must be a valid UUID'),
    body('sellerName')
        .notEmpty().withMessage('Seller name is required')
        .isString().withMessage('Seller name must be a string'),
    body('rating')
        .isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer between 1 and 5'),
    body('comment')
        .optional({ nullable: true }).isString().withMessage('Comment must be a string')
        .isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters'), // Example max length

    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler,
];

export const validateGetReviews: RequestHandler[] = [
    query('productId')
        .optional().isUUID().withMessage('Product ID must be a valid UUID if provided'),
    query('sellerId')
        .optional().isUUID().withMessage('Seller ID must be a valid UUID if provided'),
    query('orderId')
        .optional().isUUID().withMessage('Order ID must be a valid UUID if provided'),
    query('page')
        .optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
        .optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),

    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler,
];


export const validateGetCropListings: RequestHandler[] = [
    query('status')
        .optional()
        .isIn(Object.values(CropListingStatus))
        .withMessage(`Status must be one of: ${Object.values(CropListingStatus).join(', ')}`),
    query('farmer_id')
        .optional()
        .isString()
        .notEmpty()
        .withMessage('Farmer ID must be a non-empty string'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateApproveCrop: RequestHandler[] = [
    param('cropId')
        .isUUID()
        .withMessage('Invalid crop ID format. Must be a valid UUID.'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateRejectCrop: RequestHandler[] = [
    param('cropId')
        .isUUID()
        .withMessage('Invalid crop ID format. Must be a valid UUID.'),
    body('reason')
        .optional() // Reason is optional
        .isString()
        .trim()
        .isLength({ min: 1, max: 500 })
        .withMessage('Rejection reason must be a string between 1 and 500 characters.'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateFlagCrop: RequestHandler[] = [
    param('cropId')
        .isUUID()
        .withMessage('Invalid crop ID format. Must be a valid UUID.'),
    body('reason')
        .notEmpty() // Reason is required for flagging
        .isString()
        .trim()
        .isLength({ min: 5, max: 500 }) // Example: minimum 5 characters for a meaningful reason
        .withMessage('Flagging reason is required and must be a string between 5 and 500 characters.'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];


export const validateGetFarmerProfiles: RequestHandler[] = [
    query('status').optional().isIn(Object.values(VerificationStatus))
        .withMessage(`Invalid status. Must be one of: ${Object.values(VerificationStatus).join(', ')}`),
    query('name').optional().isString().trim().notEmpty().withMessage('Name must be a non-empty string'),
    query('email').optional().isEmail().withMessage('Invalid email format'),
    query('businessName').optional().isString().trim().notEmpty().withMessage('Business name must be a non-empty string'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateFarmerId: RequestHandler[] = [
    param('id').isUUID().withMessage('Invalid farmer ID format (must be UUID)'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateRejectFarmer: RequestHandler[] = [
    body('reason').isString().trim().notEmpty().withMessage('Rejection reason is required'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];


export const validateCreateReport: RequestHandler[] = [
    body('targetId').notEmpty().withMessage('Target ID is required').isString(),
    body('targetType')
        .notEmpty().withMessage('Target type is required')
        .isIn(Object.values(ReportTargetType)).withMessage(`Target type must be one of: ${Object.values(ReportTargetType).join(', ')}`),
    body('targetName')
        .notEmpty().withMessage('Target name is required')
        .isString()
        .trim()
        .isLength({ min: 1, max: 255 }).withMessage('Target name must be between 1 and 255 characters'),
    body('reportType')
        .notEmpty().withMessage('Report type is required')
        .isIn(Object.values(ReportType)).withMessage(`Report type must be one of: ${Object.values(ReportType).join(', ')}`),
    body('description')
        .notEmpty().withMessage('Description is required')
        .isString()
        .trim()
        .isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateReportStatusUpdate: RequestHandler[] = [
    // Validate reportId from params
    param('reportId').isUUID().withMessage('Report ID must be a valid UUID').notEmpty().withMessage('Report ID is required'),
    // Validate status from body
    body('status')
        .optional() // It's optional as adminNotes/actionTaken might be updated without status change
        .isIn(Object.values(ReportStatus)).withMessage(`Status must be one of: ${Object.values(ReportStatus).join(', ')}`),
    // Validate adminNotes from body
    body('adminNotes')
        .optional()
        .isString().withMessage('Admin notes must be a string')
        .trim()
        .isLength({ min: 1, max: 1000 }).withMessage('Admin notes must be between 1 and 1000 characters')
        .bail() // Stop if it's not a string/too short
        .isString().withMessage('Admin notes must be a string or null')
        .custom(value => value === null || (typeof value === 'string' && value.length > 0))
        .withMessage('Admin notes cannot be an empty string, must be string or null'),
    // Validate actionTaken from body
    body('actionTaken')
        .optional()
        .isString().withMessage('Action taken must be a string')
        .trim()
        .isLength({ min: 1, max: 255 }).withMessage('Action taken must be between 1 and 255 characters')
        .bail() // Stop if it's not a string/too short
        .custom(value => value === null || (typeof value === 'string' && value.length > 0))
        .withMessage('Action taken cannot be an empty string, must be string or null'),

    // The final middleware to check for validation errors
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateSendMessage: RequestHandler[] = [
    body('conversationId')
        .notEmpty().withMessage('Conversation ID is required')
        .isString().withMessage('Conversation ID must be a string'),
    body('receiverId')
        .notEmpty().withMessage('Receiver ID is required')
        .isString().withMessage('Receiver ID must be a string'),
    body('content')
        .notEmpty().withMessage('Message content cannot be empty')
        .isString().withMessage('Message content must be a string'),
    body('type')
        .isIn(Object.values(MessageType))
        .withMessage(`Message type must be one of: ${Object.values(MessageType).join(', ')}`),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateCreateConversation: RequestHandler[] = [
    body('participantId')
        .notEmpty().withMessage('Participant ID is required')
        .isString().withMessage('Participant ID must be a string'),
    body('productId')
        .optional() // This field is optional
        .isString().withMessage('Product ID must be a string if provided'),
    body('productName')
        .optional() // This field is optional
        .isString().withMessage('Product name must be a string if provided'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateMarkMessagesRead: RequestHandler[] = [
    param('conversationId') // This comes from the URL parameter, not the body
        .notEmpty().withMessage('Conversation ID is required in params')
        .isString().withMessage('Conversation ID in params must be a string'),
    // Note: MarkMessagesReadRequestDTO can be empty or have conversationId.
    // If it's *only* using the param, you don't need a body validation here for it.
    // If you plan to send it in the body for other mark-read logic, you'd add:
    // body('conversationId').optional().isString().withMessage('Conversation ID in body must be a string'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateApproveApplication: RequestHandler[] = [
    // Validate the applicationId from URL parameters
    param('applicationId').isUUID().withMessage('Invalid application ID format.'),
    // notes is optional for approval, but if provided, it should be a string
    body('notes').optional().isString().trim().withMessage('Notes must be a string.'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateRejectApplication: RequestHandler[] = [
    // Validate the applicationId from URL parameters
    param('applicationId').isUUID().withMessage('Invalid application ID format.'),
    // notes is required for rejection and must be a non-empty string
    body('notes').notEmpty().withMessage('Rejection notes are required.')
        .isString().trim().withMessage('Notes must be a string.'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];

export const validateSuspendUser: RequestHandler[] = [
    // Validate the userId from URL parameters
    param('userId').isUUID().withMessage('Invalid user ID format.'),
    // reason is required for suspension and must be a non-empty string
    body('reason').notEmpty().withMessage('Suspension reason is required.')
        .isString().trim().withMessage('Reason must be a string.'),
    ((req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }) as RequestHandler
];