import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import type { ApiProblemBody } from './api-problem.js';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const reply = context.getResponse<FastifyReply>();

    let body: ApiProblemBody;
    if (exception instanceof ZodError) {
      body = {
        code: 'VALIDATION_FAILED',
        errors: exception.issues.map((issue) => ({
          code: issue.code.toUpperCase(),
          field: issue.path.join('.'),
          message: issue.message,
        })),
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        title: 'Request validation failed',
        type: 'https://api.vibeshub.com/problems/validation-failed',
      };
    } else if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const status = exception.getStatus();
      body =
        typeof response === 'object' && response !== null && 'code' in response
          ? (response as ApiProblemBody)
          : {
              code: status === 404 ? 'RESOURCE_NOT_FOUND' : 'MALFORMED_REQUEST',
              detail: typeof response === 'string' ? response : exception.message,
              status,
              title: HttpStatus[status] ?? 'Request failed',
              type: 'about:blank',
            };
    } else {
      body = {
        code: 'INTERNAL_ERROR',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        title: 'An unexpected error occurred',
        type: 'about:blank',
      };
    }

    void reply
      .header('content-type', 'application/problem+json')
      .status(body.status)
      .send({ ...body, instance: request.url, requestId: request.id });
  }
}
