import { Controller, Get, Param, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { Public } from '../auth/auth.decorators.js';
import { RedirectService } from './redirect.service.js';

const unavailablePage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link unavailable | VibesHub</title></head>
<body><main><h1>This shopping link is unavailable</h1><p>Please return to VibesHub and try another recommendation.</p></main></body></html>`;

@Controller('go')
@Public()
export class RedirectController {
  constructor(private readonly redirects: RedirectService) {}

  @Get(':publicId')
  async redirect(
    @Param('publicId') publicId: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const destination = await this.redirects.resolve(publicId);
    reply
      .header('cache-control', 'no-store, max-age=0')
      .header(
        'content-security-policy',
        "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      )
      .header('referrer-policy', 'no-referrer')
      .header('x-content-type-options', 'nosniff');

    if (!destination) {
      reply.status(404).type('text/html; charset=utf-8').send(unavailablePage);
      return;
    }

    reply.status(302).header('location', destination).send();
  }
}
