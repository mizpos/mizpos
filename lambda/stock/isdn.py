"""
ISDN (国際標準同人誌番号) および JAN バーコード生成ユーティリティ

ISDN仕様:
- 13桁固定長
- フラグ: 278-279
- グループ記号: 1-5桁 (日本は4)
- 出版者記号 + 書名記号: ランダム
- チェックデジット: モジュラス10 ウェイト3・1
"""

import random
import string


def calculate_check_digit(digits: str) -> int:
    """モジュラス10 ウェイト3・1でチェックデジットを計算"""
    total = 0
    for i, digit in enumerate(digits):
        weight = 1 if i % 2 == 0 else 3
        total += int(digit) * weight
    remainder = total % 10
    return 0 if remainder == 0 else 10 - remainder


def generate_isdn(group: str = "4") -> str:
    """
    ISDNを生成

    Args:
        group: グループ記号 (日本は "4")

    Returns:
        ハイフン区切りのISDN (例: "278-4-702901-97-8")
    """
    # フラグ (278 or 279)
    flag = random.choice(["278", "279"])

    # グループ記号の長さに応じて出版者記号と書名記号の長さを決定
    # 合計で 10桁 - フラグ3桁 - グループ記号の長さ = 残り桁数
    # 残り桁数 = 出版者記号 + 書名記号 + チェックデジット1桁
    group_len = len(group)
    remaining = 10 - 3 - group_len - 1  # フラグ3桁 + チェックデジット1桁を除く

    # 出版者記号と書名記号の長さをランダムに決定
    # 出版者記号: 1-7桁、書名記号: 1-2桁
    if remaining >= 3:
        publisher_len = min(7, remaining - 1)
        title_len = remaining - publisher_len
    else:
        publisher_len = remaining - 1
        title_len = 1

    # 乱数で生成
    publisher_code = "".join(random.choices(string.digits, k=publisher_len))
    title_code = "".join(random.choices(string.digits, k=title_len))

    # チェックデジット計算用の12桁
    base_digits = f"{flag}{group}{publisher_code}{title_code}"
    check_digit = calculate_check_digit(base_digits)

    # ハイフン区切りで返す
    return f"{flag}-{group}-{publisher_code}-{title_code}-{check_digit}"


def format_isdn_with_ccode(isdn: str, c_code: str = "3055") -> str:
    """
    ISDNにCコードを付与

    Args:
        isdn: ハイフン区切りのISDN
        c_code: Cコード (4桁)

    Returns:
        Cコード付きISDN (例: "ISDN278-4-702901-97-8 C3055")
    """
    return f"ISDN{isdn} C{c_code}"


def format_isdn_with_price(isdn: str, c_code: str, price: int) -> str:
    """
    ISDNに価格を付与

    Args:
        isdn: ハイフン区切りのISDN
        c_code: Cコード (4桁)
        price: 価格

    Returns:
        価格付きISDN (例: "ISDN278-4-702901-97-8 C3055 ¥100E")
    """
    return f"ISDN{isdn} C{c_code} ¥{price}E"


def generate_jan_barcode(isdn: str) -> str:
    """
    ISDNから1段目JANバーコード（13桁）を生成

    Args:
        isdn: ハイフン区切りのISDN

    Returns:
        13桁のJANコード (例: "2784702901978")
    """
    # ハイフンを除去
    return isdn.replace("-", "")


def generate_secondary_barcode(c_code: str, price: int) -> str:
    """
    2段目バーコード（書籍JANコード2段目準拠）を生成

    Args:
        c_code: Cコード (4桁)
        price: 価格

    Returns:
        13桁の2段目バーコード (例: "2923055001007")
    """
    # フラグ: 292
    flag = "292"

    # Cコード: 4桁
    c_code_padded = c_code.zfill(4)

    # 価格: 5桁ゼロパディング
    price_padded = str(price).zfill(5)[-5:]  # 最大5桁

    # 12桁の基数
    base_digits = f"{flag}{c_code_padded}{price_padded}"

    # チェックデジット計算
    check_digit = calculate_check_digit(base_digits)

    return f"{base_digits}{check_digit}"


def generate_instore_barcode(product_id: str, price: int) -> str:
    """
    ISDNが付与されていない場合のインストアバーコードを生成

    Args:
        product_id: 商品ID
        price: 価格

    Returns:
        13桁のインストアバーコード (201スタート)
    """
    # フラグ: 201
    flag = "201"

    # 商品IDから数値部分を抽出（UUIDなら最初の8文字のハッシュ）
    # 8桁の識別子を生成
    import hashlib

    hash_val = hashlib.md5(product_id.encode()).hexdigest()
    product_num = str(int(hash_val[:8], 16) % 100000000).zfill(8)

    # 12桁の基数
    base_digits = f"{flag}{product_num}0"  # 末尾0は予備

    # チェックデジット計算
    check_digit = calculate_check_digit(base_digits)

    return f"{base_digits}{check_digit}"


def generate_instore_secondary_barcode(price: int, c_code: str = "3055") -> str:
    """
    ISDNが付与されていない場合の2段目バーコードを生成

    Args:
        price: 価格
        c_code: Cコード (デフォルト: 3055)

    Returns:
        13桁の2段目バーコード (201スタート)
    """
    # 書籍JANコードの2段目と同様の形式で生成
    return generate_secondary_barcode(c_code, price)


def generate_full_barcode_info(
    isdn: str | None = None,
    product_id: str = "",
    price: int = 0,
    c_code: str = "3055",
    is_book: bool = True,
    jan_code: str | None = None,
) -> dict:
    """
    完全なバーコード情報を生成

    Args:
        isdn: ISBN/ISDNが既に付与されている場合はその値（ハイフン区切り）
        product_id: 商品ID (ISDN未付与時に使用)
        price: 価格
        c_code: Cコード（書籍の場合のみ使用）
        is_book: 書籍フラグ
        jan_code: JANコード（書籍・非書籍共通、指定時は最優先）

    Returns:
        バーコード情報の辞書
    """
    if is_book:
        # 書籍の場合: 2段バーコード
        # 優先順位: jan_code > isdn > インハウスコード
        if jan_code:
            # JANコードが明示的に指定されている場合（既存の書籍JANを使う場合）
            jan_barcode = jan_code
            # ISDNも指定されていれば表示用に使用
            if isdn:
                isdn_formatted = format_isdn_with_price(isdn, c_code, price)
            else:
                isdn_formatted = None
        elif isdn:
            # ISBN/ISDNが付与されている場合
            jan_barcode = generate_jan_barcode(isdn)
            isdn_formatted = format_isdn_with_price(isdn, c_code, price)
        else:
            # ISBN/ISDNがない場合はインハウスコードを生成
            jan_barcode = generate_instore_barcode(product_id, price)
            isdn_formatted = None

        # 2段目バーコード: 292 + Cコード4桁 + 価格5桁 + チェックデジット
        secondary_barcode = generate_secondary_barcode(c_code, price)

        return {
            "isdn": isdn,
            "isdn_formatted": isdn_formatted,
            "jan_barcode_1": jan_barcode,
            "jan_barcode_2": secondary_barcode,
            "is_book": True,
            "full_display": (
                f"{isdn_formatted or 'インストアコード'}\n"
                f"{jan_barcode} / {secondary_barcode}"
            ),
        }
    else:
        # 非書籍の場合: 単一バーコード
        if jan_code:
            # JANコードが指定されている場合はそれを使用
            jan_barcode = jan_code
        else:
            # JANコードがない場合はインハウスコードを生成
            jan_barcode = generate_instore_barcode(product_id, price)

        return {
            "isdn": None,
            "isdn_formatted": None,
            "jan_barcode_1": jan_barcode,
            "jan_barcode_2": None,  # 非書籍は2段目なし
            "is_book": False,
            "full_display": f"JANコード\n{jan_barcode}",
        }


def validate_isdn(isdn: str) -> bool:
    """
    ISDNの形式とチェックデジットを検証

    Args:
        isdn: ハイフン区切りのISDN

    Returns:
        有効な場合True
    """
    parts = isdn.split("-")
    if len(parts) != 5:
        return False

    # フラグチェック
    if parts[0] not in ["278", "279"]:
        return False

    # 数字のみかチェック
    digits = "".join(parts)
    if not digits.isdigit() or len(digits) != 13:
        return False

    # チェックデジット検証
    base = digits[:12]
    check = int(digits[12])
    return calculate_check_digit(base) == check
