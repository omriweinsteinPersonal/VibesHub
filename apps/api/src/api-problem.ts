import { HttpException } from '@nestjs/common';

export interface ApiProblemBody {
  code: string;
  detail?: string;
  errors?: Array<{ code: string; field?: string; message: string }>;
  status: number;
  title: string;
  type: string;
}

export class ApiProblem extends HttpException {
  constructor(body: ApiProblemBody) {
    super(body, body.status);
  }
}

export function problem(
  status: number,
  code: string,
  title: string,
  detail?: string,
  errors?: ApiProblemBody['errors'],
): ApiProblem {
  const body: ApiProblemBody = {
    code,
    status,
    title,
    type: `https://api.vibeshub.com/problems/${code.toLowerCase().replaceAll('_', '-')}`,
  };
  if (detail) body.detail = detail;
  if (errors) body.errors = errors;
  return new ApiProblem(body);
}
