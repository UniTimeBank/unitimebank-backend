import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditLedgerEntry } from '../entities/credit-ledger-entry.entity';
import { LedgerDirection, EntryType, ReferenceKind } from '../enums';
import {
  GetWalletHistoryQueryDto,
  GetWalletHistoryResponseDto,
  CreditLedgerEntryDto,
  LedgerDirectionDto,
  LedgerEntryTypeDto,
} from '@app/contracts/wallet';

@Injectable()
export class WalletLedgerService {
  constructor(
    @InjectRepository(CreditLedgerEntry)
    private readonly ledgerRepo: Repository<CreditLedgerEntry>,
  ) {}

  /**
   * Thêm một bản ghi nhật ký sổ cái (Append-only)
   */
  async recordEntry(data: {
    walletId: string;
    userId: string;
    direction: LedgerDirection;
    entryType: EntryType;
    amount: number;
    balanceAfter: number;
    referenceId?: string;
    referenceKind?: ReferenceKind;
  }): Promise<CreditLedgerEntry> {
    const entry = this.ledgerRepo.create({
      walletId: data.walletId,
      userId: data.userId,
      direction: data.direction,
      entryType: data.entryType,
      amount: data.amount,
      balanceAfter: data.balanceAfter,
      referenceId: data.referenceId,
      referenceKind: data.referenceKind,
    });
    return this.ledgerRepo.save(entry);
  }

  /**
   * Truy vấn lịch sử giao dịch sổ cái kèm bộ lọc và phân trang
   */
  async getHistory(
    userId: string,
    query: GetWalletHistoryQueryDto,
  ): Promise<GetWalletHistoryResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const qb = this.ledgerRepo
      .createQueryBuilder('entry')
      .where('entry.user_id = :userId', { userId });

    if (query.type) {
      qb.andWhere('entry.direction = :direction', { direction: query.type });
    }

    if (query.entryType) {
      qb.andWhere('entry.entry_type = :entryType', { entryType: query.entryType });
    }

    if (query.from) {
      qb.andWhere('entry.created_at >= :from', { from: new Date(query.from) });
    }

    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setHours(23, 59, 59, 999);
      qb.andWhere('entry.created_at <= :to', { to: toDate });
    }

    qb.orderBy('entry.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [entries, total] = await qb.getManyAndCount();

    const formattedEntries: CreditLedgerEntryDto[] = entries.map((e) => ({
      id: e.id,
      direction: e.direction as unknown as LedgerDirectionDto,
      entryType: e.entryType as unknown as LedgerEntryTypeDto,
      amount: e.amount,
      balanceAfter: e.balanceAfter,
      referenceId: e.referenceId,
      referenceKind: e.referenceKind,
      createdAt: e.createdAt,
    }));

    return {
      entries: formattedEntries,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
