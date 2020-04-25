import path from 'path';
import fs from 'fs';
import csvParse from 'csv-parse';
import { getCustomRepository, getRepository, In } from 'typeorm';

import uploadConfig from '../config/upload';

import TransactionsRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';
import Transaction from '../models/Transaction';

interface RequestDTO {
  transactionsFilename: string;
}

interface TransactionDTO {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

interface TransactionToCreateDTO {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: Category;
}

class ImportTransactionsService {
  async execute({ transactionsFilename }: RequestDTO): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const csvFilePath = path.join(uploadConfig.directory, transactionsFilename);
    const readCSVStream = fs.createReadStream(csvFilePath);

    const parseStream = csvParse({
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });

    const parseCSV = readCSVStream.pipe(parseStream);

    const lines: TransactionDTO[] = [];

    parseCSV.on('data', line => {
      const [title, type, value, category] = line;

      lines.push({
        title,
        type,
        value,
        category,
      });
    });

    await new Promise(resolve => {
      parseCSV.on('end', resolve);
    });

    const transactionsCategories: Array<string> = [];

    lines.forEach(line => {
      if (transactionsCategories.indexOf(line.category) === -1) {
        transactionsCategories.push(line.category);
      }
    });

    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(transactionsCategories),
      },
    });

    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    const addCategoriesTitle = transactionsCategories.filter(
      transaction => !existentCategoriesTitles.includes(transaction),
    );

    const newCategories = categoriesRepository.create(
      addCategoriesTitle.map(title => ({ title })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

    const transactionsList = lines.map(transaction => {
      const [transactionCategory] = finalCategories.filter(
        category => category.title === transaction.category,
      );

      return {
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: transactionCategory,
      };
    });

    const createdTransactions = transactionsRepository.create(transactionsList);

    await transactionsRepository.save(createdTransactions);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
