import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields = result.error.issues.map((e) => ({
        path: e.path.map(String).join('.'),
        message: e.message,
      }));
      res.status(400).json({ success: false, error: 'Validation failed.', fields });
      return;
    }
    req.body = result.data;
    next();
  };
}
