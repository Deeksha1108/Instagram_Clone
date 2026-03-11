import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'loginIdentifier', async: false })
export class LoginIdentifierConstraint implements ValidatorConstraintInterface {

  validate(value: any, args: ValidationArguments) {
    const obj = args.object as any;

    return (
      (!!obj.email && !obj.phone && !obj.username) ||
      (!obj.email && !!obj.phone && !obj.username) ||
      (!obj.email && !obj.phone && !!obj.username)
    );
  }

  defaultMessage(args: ValidationArguments) {
    return 'Provide exactly one of email, phone, or username';
  }
}