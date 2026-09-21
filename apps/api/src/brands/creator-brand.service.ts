import { Injectable } from '@nestjs/common';
import type { CreatorBrandInput } from '@vibeshub/contracts';
import { problem } from '../api-problem.js';
import { CreatorBrandRepository } from './creator-brand.repository.js';

@Injectable()
export class CreatorBrandService {
  constructor(private readonly brands: CreatorBrandRepository) {}
  async list(userId: string) { return this.require(await this.brands.list(userId)); }
  async create(userId: string, input: CreatorBrandInput) { return this.require(await this.brands.create(userId, input)); }
  async update(id: string, userId: string, version: number, input: CreatorBrandInput) { return this.require(await this.brands.update(id, userId, version, input)); }
  async archive(id: string, userId: string, version: number) {
    if (!(await this.brands.archive(id, userId, version))) throw problem(412, 'PRECONDITION_FAILED', 'Reload the brand and retry with its current version');
  }
  private require<T>(value: T | null): T { if (value) return value; throw problem(403, 'CAPABILITY_REQUIRED', 'An approved creator profile is required'); }
}
