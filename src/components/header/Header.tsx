import logo from "@/assets/svgs/chanel.svg";
import Image from "next/image";
import menu from "@/assets/svgs/menu.svg";
import account from "@/assets/svgs/account.svg";
import search from "@/assets/svgs/search.svg";
import cart from "@/assets/svgs/cart.svg";

function Header() {
  return (
    <nav className="flex w-full items-center justify-between p-18">
      <div className="flex gap-15">
        <Image src={menu} alt="menu" width={24} height={24} />
        <Image src={search} alt="search" width={24} height={24} />
      </div>
      <Image src={logo} alt="logo" width={100} height={100} />
      <div className="flex gap-15">
        <Image src={cart} alt="cart" width={24} height={24} />
        <Image src={account} alt="account" width={24} height={24} />
      </div>
    </nav>
  );
}

export default Header;
