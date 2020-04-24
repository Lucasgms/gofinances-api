import { EntityRepository, Repository } from 'typeorm';

import Transaction from '../models/Transaction';

interface Balance {
  income: number;
  outcome: number;
  total: number;
}

@EntityRepository(Transaction)
class TransactionsRepository extends Repository<Transaction> {
  public async getBalance(): Promise<Balance> {
    const transactions = await this.find();
    const income = this.getAmountByType(transactions, 'income');

    const outcome = this.getAmountByType(transactions, 'outcome');

    const total = income - outcome;

    return { income, outcome, total };
  }

  private getAmountByType(
    transactions: Array<Transaction>,
    type: string,
  ): number {
    return transactions.reduce((total, current) => {
      return current.type === type ? total + current.value : total;
    }, 0);
  }
}

export default TransactionsRepository;
