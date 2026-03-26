import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'loginIdentifier', async: false })
export class LoginIdentifierConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const obj = args.object as any;

    if (!obj.email && !obj.username) return false;
    if (obj.email && obj.username) return false;
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Either email or username is required';
  }
}