import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { AUTH_MESSAGES } from 'src/modules/auth/response/auth.response';

@ValidatorConstraint({ name: 'loginIdentifier', async: false })
export class LoginIdentifierConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const obj = args.object as any;

    if (!obj.email && !obj.username) return false;
    if (obj.email && obj.username) return false;
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return AUTH_MESSAGES.PROVIDE_EMAIL_OR_USERNAME;
  }
}