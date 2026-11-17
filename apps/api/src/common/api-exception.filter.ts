import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/** Preserve the client-facing `{ message, code? }` error contract. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(error: any, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();
    const status = error?.statusCode || (error instanceof HttpException ? error.getStatus() : 500);
    const nestBody = error instanceof HttpException ? error.getResponse() : null;
    const nestedMessage = typeof nestBody === 'object' && nestBody !== null ? (nestBody as any).message : null;
    const message = status === 500 ? 'Something went wrong' :
      status === 404 && typeof nestedMessage === 'string' && nestedMessage.startsWith('Cannot ') ? 'Route not found' :
      error?.message || 'Request failed';
    this.logger.error(`API request failed ${request.path}: ${error?.name || 'Error'} (${status})`, status === 500 ? error?.stack : undefined);
    response.status(status).json({ message, ...(typeof error?.code === 'string' ? { code: error.code } : {}) });
  }
}
