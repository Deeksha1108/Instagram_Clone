import {
    ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'emailOrPhone', async: false })
export class EmailOrPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const obj = args.object as any;
    return (!!obj.email && !obj.phone) || (!obj.email && !!obj.phone);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Provide exactly one of email or phone';
  }
}
