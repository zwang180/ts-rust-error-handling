import Result from '../result/Result';

enum OptionType {
  None,
  Some
}

type OptionInit<T> = { type: OptionType.None } | { type: OptionType.Some; value: T };
type OptionInternal<T> = OptionInit<T>;
type OptionValueGetter<T> = () => T;
type OptionErrorGetter<E> = () => E;
type OptionValueConverter<T, U> = (value: T) => Option<U>;
type OptionGetter<T> = () => Option<T>;
type OptionValuePredicate<T> = (value: T) => boolean;
type OptionValueMapper<T, U> = (value: T) => U;
type OptionValueZipper<T, U, R> = (value: T, otherValue: U) => R;

/*
 * Spec: https://doc.rust-lang.org/std/option/
 *
 * Omitted categories of methods:
 *   - Adapters for working with references
 *   - Comparison operators
 *   - Iterating over `Option` (reference related variants)
 *   - Collecting into `Option`
 */
export default class Option<T> {
  static None<TValue = unknown>(): Option<TValue> {
    const init: OptionInit<TValue> = { type: OptionType.None };

    return new Option<TValue>(init);
  }

  static Some<TValue>(value: TValue): Option<TValue> {
    const init: OptionInit<TValue> = { type: OptionType.Some, value };

    return new Option<TValue>(init);
  }

  protected internal: OptionInternal<T>;

  private constructor(init: OptionInit<T>) {
    this.internal = { ...init };
  }

  /*
   * Querying the variant
   */
  isNone(): boolean {
    return this.internal.type === OptionType.None;
  }

  isSome(): boolean {
    return this.internal.type === OptionType.Some;
  }

  /*
   * Extracting the contained value
   */
  expect(message: string): T {
    if (this.internal.type === OptionType.None) {
      throw new Error(message);
    }

    return this.internal.value;
  }

  unwrap(): T {
    if (this.internal.type === OptionType.None) {
      throw new Error('Called `Option.unwrap()` on a `None` value.');
    }

    return this.internal.value;
  }

  unwrapOr(defaultValue: T): T {
    return this.internal.type === OptionType.None ? defaultValue : this.internal.value;
  }

  unwrapOrElse(defaultValueFunc: OptionValueGetter<T>): T {
    return this.internal.type === OptionType.None ? defaultValueFunc() : this.internal.value;
  }

  unwrapOrDefault(): T {
    throw new Error('Not implemented: use either `unwrapOr` or `unwrapOrElse` instead.');
  }

  /*
   * Transforming contained values
   */
  okOr<E>(error: E): Result<T, E> {
    if (this.internal.type === OptionType.None) {
      return Result.Err<E, T>(error);
    }

    return Result.Ok<T, E>(this.internal.value);
  }

  okOrElse<E>(errorFunc: OptionErrorGetter<E>): Result<T, E> {
    if (this.internal.type === OptionType.None) {
      return Result.Err<E, T>(errorFunc());
    }

    return Result.Ok<T, E>(this.internal.value);
  }

  transpose<E>(): Result<Option<T>, E> {
    if (this.internal.type === OptionType.None) {
      const init: OptionInit<T> = { type: OptionType.None };
      return Result.Ok<Option<T>, E>(new Option<T>(init));
    }

    if (this.internal.type === OptionType.Some) {
      const { value } = this.internal;
      if (value instanceof Result) {
        return value.isErr()
          ? Result.Err<E, Option<T>>(value.unwrapErr())
          : Result.Ok<Option<T>, E>(value.unwrap());
      }
    }

    throw new Error('Called `transpose` on a invalid `Some` value.');
  }

  filter(predicate: OptionValuePredicate<T>): Option<T> {
    if (this.internal.type === OptionType.Some && predicate(this.internal.value)) {
      const init = { ...this.internal };
      return new Option<T>(init);
    }

    const init: OptionInit<T> = { type: OptionType.None };
    return new Option<T>(init);
  }

  flatten<U>(): Option<U> {
    if (this.internal.type === OptionType.None) {
      const init: OptionInit<U> = { type: OptionType.None };
      return new Option<U>(init);
    }

    if (this.internal.type === OptionType.Some) {
      const { value } = this.internal;
      if (value instanceof Option) {
        const init: OptionInit<U> =
          value.internal.type === OptionType.None
            ? { type: OptionType.None }
            : { type: OptionType.Some, value: value.unwrap() };

        return new Option<U>(init);
      }
    }

    throw new Error('Called `flatten` on a non-nested `Some` value.');
  }

  map<U>(valueMapperFunc: OptionValueMapper<T, U>): Option<U> {
    const init: OptionInit<U> =
      this.internal.type === OptionType.None
        ? { type: OptionType.None }
        : { type: OptionType.Some, value: valueMapperFunc(this.internal.value) };

    return new Option<U>(init);
  }

  mapOr<U>(defaultValue: U, valueMapperFunc: OptionValueMapper<T, U>): U {
    if (this.internal.type === OptionType.None) {
      return defaultValue;
    }

    return valueMapperFunc(this.internal.value);
  }

  mapOrElse<U>(
    defaultValueFunc: OptionValueGetter<U>,
    valueMapperFunc: OptionValueMapper<T, U>
  ): U {
    if (this.internal.type === OptionType.None) {
      return defaultValueFunc();
    }

    return valueMapperFunc(this.internal.value);
  }

  zip<U>(other: Option<U>): Option<[T, U]> {
    const init: OptionInit<[T, U]> =
      this.internal.type === OptionType.None || other.internal.type === OptionType.None
        ? { type: OptionType.None }
        : {
            type: OptionType.Some,
            value: [this.internal.value, other.unwrap()]
          };

    return new Option<[T, U]>(init);
  }

  zipWith<U, R>(other: Option<U>, valueZipperFunc: OptionValueZipper<T, U, R>): Option<R> {
    const init: OptionInit<R> =
      this.internal.type === OptionType.None || other.internal.type === OptionType.None
        ? { type: OptionType.None }
        : {
            type: OptionType.Some,
            value: valueZipperFunc(this.internal.value, other.unwrap())
          };

    return new Option<R>(init);
  }

  /**
   * Boolean operators
   */
  and<U>(other: Option<U>): Option<U> {
    if (this.internal.type === OptionType.None) {
      // This is safe since all `None` values are the same
      return this as unknown as Option<U>;
    }

    return other;
  }

  or(other: Option<T>): Option<T> {
    return this.internal.type === OptionType.None ? other : this;
  }

  xor(other: Option<T>): Option<T> {
    if (this.internal.type === OptionType.Some && other.internal.type === OptionType.None) {
      return this;
    }

    if (this.internal.type === OptionType.None && other.internal.type === OptionType.Some) {
      return other;
    }

    // Doesn't matter since all `None` values are the same
    return this;
  }

  andThen<U>(valueConverterFunc: OptionValueConverter<T, U>): Option<U> {
    if (this.internal.type === OptionType.None) {
      // This is safe since all `None` values are the same
      return this as unknown as Option<U>;
    }

    return valueConverterFunc(this.internal.value);
  }

  orElse(getterFunc: OptionGetter<T>): Option<T> {
    return this.internal.type === OptionType.None ? getterFunc() : this;
  }

  /*
   * Iterating over `Option`
   */
  *intoIter(): Generator<T> {
    if (this.internal.type === OptionType.None) {
      return;
    }

    yield this.internal.value;
  }

  /*
   * Modifying an Option in-place
   */
  insert(value: T): T {
    if (this.internal.type === OptionType.None) {
      this.internal = { type: OptionType.Some, value };
    } else {
      this.internal.value = value;
    }

    return this.internal.value;
  }

  getOrInsert(value: T): T {
    if (this.internal.type === OptionType.None) {
      this.internal = { type: OptionType.Some, value };
    }

    return this.internal.value;
  }

  getOrInsertWith(insertValueFunc: OptionValueGetter<T>): T {
    if (this.internal.type === OptionType.None) {
      this.internal = { type: OptionType.Some, value: insertValueFunc() };
    }

    return this.internal.value;
  }

  getOrInsertDefault(): T {
    throw new Error('Not implemented: use either `getOrInsert` or `getOrInsertWith` instead.');
  }

  take(): Option<T> {
    const init = this.internal;
    this.internal = { type: OptionType.None };

    return new Option<T>(init);
  }

  replace(value: T): Option<T> {
    const init = this.internal;
    this.internal = { type: OptionType.Some, value };

    return new Option<T>(init);
  }
}
