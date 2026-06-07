import { ApiProperty } from '@nestjs/swagger';
import { UploadedDocumentDto } from './upload-document-response.dto';

export class DocumentListResponseDto {
  @ApiProperty({ type: [UploadedDocumentDto] })
  list!: UploadedDocumentDto[];
}
