import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator.js';
import { Caller } from '../../auth/decorators/caller.decorator.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';
import { EpcisCaptureService } from '../epcis-capture.service.js';

@ApiTags('epcis')
@Controller('epcis')
export class EpcisCaptureController {
  constructor(private readonly epcisCaptureService: EpcisCaptureService) {}

  @Auth()
  @HttpCode(201)
  @Post('capture')
  @ApiOperation({
    summary: 'Capture an EPCIS 2.0 document from a third party (US15)',
    description:
      'Pushes a third-party EPCIS 2.0 capture document (EPCIS 2.0 Capture pattern, FR-2001) authenticated with the caller organization credential. The body is either the raw EPCIS document or a wrapper `{ document, epcMapping }` where `epcMapping` carries `{ ownerActorId, productId }` for every EPC referenced by the document that is not yet commissioned (FR-2005); without it, the document is rejected with 400 and no partial effect. Events are persisted with `source: "external"` and deduped by their `eventID` / derived digest (FR-2002), projected on the twin with the local rules (FR-2004) and the whole document is imported in a single transaction. Returns `{ imported, skipped, epcsCreated }`.',
  })
  capture(@Caller() user: AuthUser, @Body() body: unknown) {
    return this.epcisCaptureService.capture(user.actorId, body);
  }
}
