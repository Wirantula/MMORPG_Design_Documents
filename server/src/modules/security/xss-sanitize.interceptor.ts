import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Global interceptor that strips HTML tags from every string property in the
 * request body.  This is a defence-in-depth measure against stored XSS — it
 * does NOT replace output encoding but ensures no raw HTML enters the domain
 * layer.
 */
@Injectable()
export class XssSanitizeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(XssSanitizeInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ body?: unknown }>();
    if (req.body && typeof req.body === 'object') {
      req.body = this.sanitize(req.body);
    }
    return next.handle();
  }

  /**
   * Recursively strip HTML tags from every string value in `obj`.
   * Returns a new object (does not mutate the original).
   */
  sanitize<T>(obj: T): T {
    if (typeof obj === 'string') {
      return this.stripTags(obj) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item)) as unknown as T;
    }

    if (obj !== null && typeof obj === 'object') {
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        cleaned[key] = this.sanitize(value);
      }
      return cleaned as T;
    }

    return obj;
  }

  /** Remove all HTML / XML tags from a string. */
  stripTags(input: string): string {
    return input.replace(/<[^>]*>/g, '');
  }
}
